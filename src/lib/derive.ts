// Pure projections of a job's event log into what the UI displays.
import type { Job, JobEvent } from "../../shared/job.ts";
import type { Clue, Estimate } from "../../shared/schema.ts";

export interface TimedEstimate {
  estimate: Estimate;
  t: number;
}

export type ActivityEvent = Extract<
  JobEvent,
  { kind: "search" | "fetch" | "zoom" | "thought" | "hint" | "status" }
>;

export interface JobView {
  estimates: TimedEstimate[];
  clues: Clue[];
  activity: ActivityEvent[];
  /** Claude's final text of the latest completed run. */
  answer?: string;
  error?: string;
  usage: { costUsd: number; turns: number; durationMs: number };
}

export function deriveJob(job: Job): JobView {
  const view: JobView = {
    estimates: [],
    clues: [],
    activity: [],
    usage: { costUsd: 0, turns: 0, durationMs: 0 },
  };
  // The last text of a run is its conclusion, shown apart from the activity log.
  let lastThought: ActivityEvent | undefined;
  for (const event of job.events) {
    switch (event.kind) {
      case "estimate":
        view.estimates.push({ estimate: event.estimate, t: event.t });
        break;
      case "clue":
        view.clues.push(event.clue);
        break;
      case "usage":
        view.usage.costUsd += event.costUsd;
        view.usage.turns += event.turns;
        view.usage.durationMs += event.durationMs;
        if (lastThought?.kind === "thought") {
          view.answer = lastThought.text;
          view.activity.splice(view.activity.indexOf(lastThought), 1);
        }
        lastThought = undefined;
        break;
      case "thought":
        lastThought = event;
        view.activity.push(event);
        break;
      case "status":
        if (event.status === "running") lastThought = undefined;
        view.error = event.status === "error" ? (event.message ?? "unknown") : undefined;
        view.activity.push(event);
        break;
      default:
        view.activity.push(event);
    }
  }
  return view;
}

/** Applies one live event to a job snapshot, mirroring server/jobs.ts. */
export function applyEvent(job: Job, event: JobEvent): Job {
  const next: Job = { ...job, events: [...job.events, event] };
  if (event.kind === "status") next.status = event.status;
  if (event.kind === "estimate") {
    next.place = event.estimate.candidates[0]?.label;
    next.level = event.estimate.level;
  }
  return next;
}
