// Job store: persistence under data/, a bounded run queue and live subscribers.
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Job, JobEvent, JobSummary } from "../shared/job.ts";
import { startRun, type MessageContent, type Run } from "./claude.ts";
import { ingestImage, viewPath } from "./images.ts";
import { hintMessage, initialMessage } from "./prompt.ts";

const MAX_RUNNING = Math.max(1, Number(process.env.CHIZU_CONCURRENCY) || 2);

type Listener = (event: JobEvent) => void;
type EventBody = Parameters<Parameters<typeof startRun>[1]["onEvent"]>[0];

export interface UploadedImage {
  name: string;
  bytes: Buffer;
}

export class JobStore {
  private readonly jobs = new Map<string, Job>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly runs = new Map<string, Run>();
  /** Jobs holding a run slot, including those still preparing their first message. */
  private readonly active = new Set<string>();
  /** Hints received while a job waits in the queue. */
  private readonly queuedHints = new Map<string, string[]>();
  private readonly queue: string[] = [];
  private readonly jobsDir: string;
  private readonly workDir: string;

  constructor(dataDir: string) {
    this.jobsDir = join(dataDir, "jobs");
    this.workDir = join(dataDir, "work");
  }

  async load(): Promise<void> {
    await mkdir(this.jobsDir, { recursive: true });
    await mkdir(this.workDir, { recursive: true });
    for (const id of await readdir(this.jobsDir)) {
      const raw = await readFile(join(this.jobsDir, id, "job.json"), "utf8").catch(() => undefined);
      if (!raw) continue;
      const job = JSON.parse(raw) as Job;
      this.jobs.set(job.id, job);
      if (job.status === "running" || job.status === "queued") {
        this.push(job, { kind: "status", status: "error", message: "interrupted" });
      }
    }
  }

  list(): JobSummary[] {
    return [...this.jobs.values()]
      .map(({ id, createdAt, status, imageCount, place, level }) => ({
        id,
        createdAt,
        status,
        imageCount,
        place,
        level,
      })) // prettier-ignore
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  imagePath(id: string, index: number): string | undefined {
    const job = this.jobs.get(id);
    if (!job || !Number.isInteger(index) || index < 0 || index >= job.imageCount) return undefined;
    return viewPath(this.dir(id), index);
  }

  async create(uploads: UploadedImage[], locale: string): Promise<Job> {
    const id = randomUUID();
    const dir = this.dir(id);
    await mkdir(dir, { recursive: true });
    try {
      const images = [];
      for (const [i, upload] of uploads.entries()) {
        images.push(await ingestImage(dir, i, upload.name, upload.bytes));
      }
      const job: Job = {
        id, createdAt: Date.now(), status: 'queued', imageCount: images.length,
        images, locale, events: [],
      }; // prettier-ignore
      this.jobs.set(id, job);
      this.push(job, { kind: "status", status: "queued" });
      this.enqueue(id);
      return job;
    } catch (err) {
      await rm(dir, { recursive: true, force: true });
      throw err;
    }
  }

  subscribe(id: string, listener: Listener): () => void {
    const set = this.listeners.get(id) ?? new Set();
    set.add(listener);
    this.listeners.set(id, set);
    return () => set.delete(listener);
  }

  /** Adds a user hint: delivered live, queued, or used to resume a finished session. */
  hint(id: string, text: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    this.push(job, { kind: "hint", text });
    const run = this.runs.get(id);
    if (run?.send(hintMessage(text))) return true;
    if (job.status === "queued") {
      this.queuedHints.set(id, [...(this.queuedHints.get(id) ?? []), text]);
      return true;
    }
    this.queuedHints.set(id, [text]);
    this.push(job, { kind: "status", status: "queued" });
    this.enqueue(id);
    return true;
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    const run = this.runs.get(id);
    if (run) run.cancel();
    else if (job.status === "queued") {
      const position = this.queue.indexOf(id);
      if (position >= 0) this.queue.splice(position, 1);
      this.push(job, { kind: "status", status: "cancelled" });
    }
    return true;
  }

  async remove(id: string): Promise<boolean> {
    if (!this.jobs.has(id)) return false;
    this.cancel(id);
    this.jobs.delete(id);
    this.listeners.delete(id);
    await rm(this.dir(id), { recursive: true, force: true });
    return true;
  }

  private dir(id: string): string {
    return join(this.jobsDir, id);
  }

  private enqueue(id: string): void {
    if (!this.queue.includes(id)) this.queue.push(id);
    this.drain();
  }

  private drain(): void {
    while (this.active.size < MAX_RUNNING && this.queue.length > 0) {
      const id = this.queue.shift();
      const job = id ? this.jobs.get(id) : undefined;
      if (job) {
        this.active.add(job.id);
        this.launch(job).catch((err: unknown) => {
          this.active.delete(job.id);
          this.push(job, { kind: "status", status: "error", message: String(err) });
          this.drain();
        });
      }
    }
  }

  private async launch(job: Job): Promise<void> {
    const hints = this.queuedHints.get(job.id) ?? [];
    this.queuedHints.delete(job.id);
    const resume = job.sessionId && hints.length > 0 ? job.sessionId : undefined;
    const first: MessageContent = resume
      ? hints.map(hintMessage).join("\n\n")
      : await this.initialContent(job, hints);
    if (job.status === "cancelled" || !this.jobs.has(job.id)) {
      this.active.delete(job.id);
      this.drain();
      return;
    }
    this.push(job, { kind: "status", status: "running" });
    const run = startRun(first, {
      jobDir: this.dir(job.id),
      imageCount: job.imageCount,
      cwd: this.workDir,
      resume,
      onEvent: (event) => this.push(job, event),
      onSession: (sessionId) => {
        job.sessionId = sessionId;
      },
      onExit: (error) => {
        this.runs.delete(job.id);
        this.active.delete(job.id);
        if (this.jobs.has(job.id)) {
          const status = error === "cancelled" ? "cancelled" : error ? "error" : "done";
          this.push(job, {
            kind: "status",
            status,
            message: status === "error" ? error : undefined,
          });
        }
        this.drain();
      },
    });
    this.runs.set(job.id, run);
  }

  private async initialContent(job: Job, hints: string[]): Promise<MessageContent> {
    const images = await Promise.all(
      job.images.map(async (_, i) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: "image/jpeg" as const,
          data: (await readFile(viewPath(this.dir(job.id), i))).toString("base64"),
        },
      })),
    );
    const text = [initialMessage(job.images, job.locale), ...hints.map(hintMessage)].join("\n\n");
    return [...images, { type: "text", text }];
  }

  private push(job: Job, body: EventBody): void {
    const event = { ...body, t: Date.now() } as JobEvent;
    job.events.push(event);
    if (event.kind === "status") job.status = event.status;
    if (event.kind === "estimate") {
      job.place = event.estimate.candidates[0]?.label;
      job.level = event.estimate.level;
    }
    for (const listener of this.listeners.get(job.id) ?? []) listener(event);
    this.persist(job);
  }

  private readonly writes = new Map<string, Promise<void>>();

  /** Serialises writes per job so job.json is never written concurrently. */
  private persist(job: Job): void {
    const previous = this.writes.get(job.id) ?? Promise.resolve();
    const next = previous
      .then(() =>
        this.jobs.has(job.id)
          ? writeFile(join(this.dir(job.id), "job.json"), JSON.stringify(job))
          : undefined,
      )
      .catch((err: unknown) => {
        process.stderr.write(`chizu: cannot save job ${job.id}: ${String(err)}\n`);
      });
    this.writes.set(job.id, next);
  }
}
