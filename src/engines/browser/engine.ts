// API engine: analyses run in the browser with the user's own Anthropic API key.
// Jobs, conversations and photos are kept in IndexedDB on this device only.
import Anthropic, {
  APIError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import type { Job, JobEvent, JobSummary } from "../../../shared/job.ts";
import { initialMessage } from "../../../shared/prompt.ts";
import { ResearchSession } from "../../../shared/research/session.ts";
import { applyEvent } from "../../lib/derive.ts";
import type { AnalysisOptions, Engine } from "../types.ts";
import { idb } from "./db.ts";
import { ingestImage } from "./images.ts";
import type { ApiModel } from "./pricing.ts";
import { runConversation } from "./runner.ts";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type EventBody = Parameters<Parameters<typeof runConversation>[0]["emit"]>[0];

export class MissingApiKeyError extends Error {
  constructor() {
    super("missing API key");
  }
}

export interface ApiConfig {
  apiKey?: string;
  model: ApiModel;
}

interface Run {
  controller: AbortController;
  hints: string[];
}

export function createBrowserEngine(config: () => ApiConfig): Engine {
  const jobs = new Map<string, Job>();
  const listeners = new Map<string, Set<(event: JobEvent) => void>>();
  const runs = new Map<string, Run>();
  const urls = new Map<string, string>();
  /** Per-job settings, in memory only: a resume after a reload runs without them. */
  const options = new Map<string, AnalysisOptions>();

  const loaded = idb.all<Job>("jobs").then(async (stored) => {
    for (const job of stored) {
      jobs.set(job.id, job);
      // A run cannot survive a page reload.
      if (job.status === "running" || job.status === "queued") {
        push(job.id, { kind: "status", status: "error", message: "interrupted" });
      }
    }
  });

  /** Jobs are immutable snapshots: every event replaces the stored object. */
  function push(id: string, body: EventBody): void {
    const job = jobs.get(id);
    if (!job) return; // Deleted meanwhile.
    const event = { ...body, t: Date.now() } as JobEvent;
    const next = applyEvent(job, event);
    jobs.set(id, next);
    for (const listener of listeners.get(id) ?? []) listener(event);
    void idb.put("jobs", id, next).catch(() => undefined); // Memory stays authoritative.
  }

  function client(): { client: Anthropic; model: ApiModel } {
    const { apiKey, model } = config();
    if (!apiKey) throw new MissingApiKeyError();
    // The key is the user's own and is sent only to api.anthropic.com.
    return { client: new Anthropic({ apiKey, dangerouslyAllowBrowser: true }), model };
  }

  /** Starts a run; `hints` reach Claude on its first turn. Throws synchronously without a key. */
  function start(job: Job, messages: MessageParam[], hints: string[] = []): void {
    const { client: anthropic, model } = client();
    const run: Run = { controller: new AbortController(), hints };
    runs.set(job.id, run);
    push(job.id, { kind: "status", status: "running" });
    void execute(job, run, anthropic, model, messages);
  }

  async function execute(
    job: Job,
    run: Run,
    anthropic: Anthropic,
    model: ApiModel,
    messages: MessageParam[],
  ) {
    try {
      await runConversation({
        client: anthropic,
        model,
        messages,
        imageCount: job.imageCount,
        research: new ResearchSession({
          signal: run.controller.signal,
          headers: {},
          mapillaryToken: options.get(job.id)?.mapillaryToken,
        }),
        original: async (index) => {
          const blob = await idb.get<Blob>("blobs", `${job.id}/${index}/orig`);
          if (!blob) throw new Error("photo missing");
          return blob;
        },
        emit: (event) => push(job.id, event),
        save: async (all) => {
          await idb.put("conversations", job.id, all);
        },
        takeHints: () => run.hints.splice(0),
        signal: run.controller.signal,
      });
      push(job.id, { kind: "status", status: "done" });
    } catch (err) {
      if (run.controller.signal.aborted) push(job.id, { kind: "status", status: "cancelled" });
      else push(job.id, { kind: "status", status: "error", message: describeError(err) });
    } finally {
      runs.delete(job.id);
    }
  }

  return {
    id: "api",

    async list(): Promise<JobSummary[]> {
      await loaded;
      return [...jobs.values()].map(({ id, createdAt, status, imageCount, place, level }) => ({
        id,
        createdAt,
        status,
        imageCount,
        place,
        level,
      }));
    },

    async create(files, locale, analysis) {
      client(); // Fail before storing anything when no key is set.
      await loaded;
      const id = crypto.randomUUID();
      options.set(id, analysis);
      const ingested = await Promise.all(files.map(ingestImage));
      for (const [i, file] of files.entries()) {
        await idb.put("blobs", `${id}/${i}/orig`, file);
        await idb.put("blobs", `${id}/${i}/view`, ingested[i]?.view);
      }
      const job: Job = {
        id,
        createdAt: Date.now(),
        status: "queued",
        imageCount: files.length,
        images: ingested.map((item) => item.image),
        locale,
        events: [],
      };
      jobs.set(id, job);
      push(id, { kind: "status", status: "queued" });
      const content: Anthropic.Beta.BetaContentBlockParam[] = [];
      for (const item of ingested) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: await toBase64(item.view) },
        });
      }
      content.push({ type: "text", text: initialMessage(job.images, locale) });
      start(job, [{ role: "user", content }]);
      return jobs.get(id) ?? job;
    },

    watch(id, onSnapshot, onEvent) {
      const set = listeners.get(id) ?? new Set();
      listeners.set(id, set);
      let active = true;
      void loaded.then(() => {
        const job = jobs.get(id);
        if (!active || !job) return;
        onSnapshot(job);
        set.add(onEvent);
      });
      return () => {
        active = false;
        set.delete(onEvent);
      };
    },

    async hint(id, text) {
      const job = jobs.get(id);
      if (!job) throw new Error("job not found");
      const run = runs.get(id);
      if (run) {
        push(id, { kind: "hint", text });
        run.hints.push(text);
        return;
      }
      client(); // Fail before recording the hint when no key is set.
      const messages = (await idb.get<MessageParam[]>("conversations", id)) ?? [];
      if (messages.length === 0) throw new Error("conversation not found");
      push(id, { kind: "hint", text });
      start(job, messages, [text]);
    },

    async cancel(id) {
      runs.get(id)?.controller.abort();
    },

    async remove(id) {
      runs.get(id)?.controller.abort();
      jobs.delete(id);
      options.delete(id);
      listeners.delete(id);
      for (const [key, url] of urls) {
        if (key.startsWith(`${id}/`)) {
          URL.revokeObjectURL(url);
          urls.delete(key);
        }
      }
      await Promise.all([
        idb.remove("jobs", id),
        idb.remove("conversations", id),
        idb.remove("blobs", id),
      ]);
    },

    async imageUrl(id, index) {
      const key = `${id}/${index}/view`;
      const cached = urls.get(key);
      if (cached) return cached;
      const blob = await idb.get<Blob>("blobs", key);
      if (!blob) throw new Error("photo missing");
      const url = URL.createObjectURL(blob);
      urls.set(key, url);
      return url;
    },
  };
}

function describeError(err: unknown): string {
  if (err instanceof MissingApiKeyError) return "missing API key";
  if (err instanceof AuthenticationError) return "invalid API key";
  if (err instanceof PermissionDeniedError) return "this API key is not allowed to use the model";
  if (err instanceof RateLimitError) return "rate limited by the API; try again shortly";
  if (err instanceof APIError) return `API error ${err.status ?? ""}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
