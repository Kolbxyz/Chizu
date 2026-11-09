// Claude Code engine: the local Node server (server/api.ts). Write requests
// carry the x-chizu header the server requires.
import type { Job, JobEvent, JobSummary } from "../../shared/job.ts";
import type { Engine } from "./types.ts";

const WRITE_HEADERS = { "x-chizu": "1" };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init);
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (body as { error?: string }).error ?? `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

export interface ServerHealth {
  claudeCode: boolean;
}

/** Resolves when the local server answers; GitHub Pages has none. */
export async function probeServer(): Promise<ServerHealth | undefined> {
  if (location.hostname.endsWith(".github.io")) return undefined;
  try {
    const response = await fetch("/api/health", { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return undefined;
    return (await response.json()) as ServerHealth;
  } catch {
    return undefined; // No server: static hosting or the server is stopped.
  }
}

export const serverEngine: Engine = {
  id: "cc",
  list: () => call<JobSummary[]>("/jobs"),

  create(files, locale) {
    const form = new FormData();
    for (const file of files) form.append("images", file);
    form.append("locale", locale);
    return call<Job>("/jobs", { method: "POST", headers: WRITE_HEADERS, body: form });
  },

  watch(id, onSnapshot, onEvent) {
    const source = new EventSource(`/api/jobs/${id}/events`);
    source.addEventListener("snapshot", (message) => onSnapshot(JSON.parse(message.data) as Job));
    source.addEventListener("event", (message) => onEvent(JSON.parse(message.data) as JobEvent));
    return () => source.close();
  },

  async hint(id, text) {
    await call(`/jobs/${id}/hint`, {
      method: "POST",
      headers: { ...WRITE_HEADERS, "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
  },

  async cancel(id) {
    await call(`/jobs/${id}/cancel`, { method: "POST", headers: WRITE_HEADERS });
  },

  async remove(id) {
    await call(`/jobs/${id}`, { method: "DELETE", headers: WRITE_HEADERS });
  },

  imageUrl: (id, index) => Promise.resolve(`/api/jobs/${id}/images/${index}`),
};
