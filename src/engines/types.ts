// Where analyses run. "cc" drives the local Claude Code CLI through the Node
// server; "api" calls the Anthropic API from the browser with the user's key.
import type { Job, JobEvent, JobSummary } from "../../shared/job.ts";

export type EngineId = "cc" | "api";

export interface Engine {
  id: EngineId;
  list(): Promise<JobSummary[]>;
  create(files: File[], locale: string): Promise<Job>;
  /** Sends the current job, then every new event. Returns the unsubscribe function. */
  watch(id: string, onSnapshot: (job: Job) => void, onEvent: (event: JobEvent) => void): () => void;
  hint(id: string, text: string): Promise<void>;
  cancel(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  /** URL of the display copy of photo `index`. */
  imageUrl(id: string, index: number): Promise<string>;
}

/** A job reference that names its engine: "<engine>:<id>". */
export type JobRef = `${EngineId}:${string}`;

export const toRef = (engine: EngineId, id: string): JobRef => `${engine}:${id}`;

export function parseRef(ref: string): { engine: EngineId; id: string } | undefined {
  const [engine, id] = ref.split(/:(.+)/);
  if ((engine === "cc" || engine === "api") && id) return { engine, id };
  return undefined;
}
