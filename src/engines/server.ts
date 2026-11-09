// Typed client of the local API. Write requests carry the x-chizu header the
// server requires (see server/api.ts).
import type { Job, JobSummary } from "../../shared/job.ts";

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

export const api = {
  list: () => call<JobSummary[]>("/jobs"),

  create(files: File[], locale: string) {
    const form = new FormData();
    for (const file of files) form.append("images", file);
    form.append("locale", locale);
    return call<Job>("/jobs", { method: "POST", headers: WRITE_HEADERS, body: form });
  },

  hint: (id: string, text: string) =>
    call<{ accepted: boolean }>(`/jobs/${id}/hint`, {
      method: "POST",
      headers: { ...WRITE_HEADERS, "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }),

  cancel: (id: string) => call(`/jobs/${id}/cancel`, { method: "POST", headers: WRITE_HEADERS }),
  remove: (id: string) => call(`/jobs/${id}`, { method: "DELETE", headers: WRITE_HEADERS }),

  imageUrl: (id: string, index: number) => `/api/jobs/${id}/images/${index}`,
  eventsUrl: (id: string) => `/api/jobs/${id}/events`,
};
