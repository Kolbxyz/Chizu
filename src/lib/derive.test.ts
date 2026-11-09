import { describe, expect, it } from "vitest";
import type { Job, JobEvent } from "../../shared/job.ts";
import { applyEvent, deriveJob } from "./derive.ts";

const base: Job = {
  id: "j1",
  createdAt: 0,
  status: "queued",
  imageCount: 1,
  images: [],
  locale: "en",
  events: [],
};

const estimate = (label: string): JobEvent => ({
  kind: "estimate",
  t: 1,
  estimate: {
    level: "country",
    summary: "",
    candidates: [{ id: label, label, lat: 0, lng: 0, radius_m: 1000, confidence: 0.5 }],
  },
});

describe("applyEvent", () => {
  it("tracks status and the best place", () => {
    let job = applyEvent(base, { kind: "status", status: "running", t: 0 });
    job = applyEvent(job, estimate("Portugal"));
    expect(job.status).toBe("running");
    expect(job.place).toBe("Portugal");
    expect(job.level).toBe("country");
    expect(base.events).toHaveLength(0);
  });
});

describe("deriveJob", () => {
  it("takes the last text of each run as its answer and sums usage", () => {
    const events: JobEvent[] = [
      { kind: "status", status: "running", t: 0 },
      { kind: "thought", text: "Looking.", t: 1 },
      estimate("Portugal"),
      { kind: "thought", text: "Lisbon, Alfama.", t: 2 },
      { kind: "usage", costUsd: 0.1, turns: 4, durationMs: 1000, t: 3 },
      { kind: "status", status: "done", t: 3 },
      { kind: "status", status: "running", t: 4 },
      { kind: "usage", costUsd: 0.05, turns: 1, durationMs: 500, t: 5 },
    ];
    const view = deriveJob({ ...base, events });
    expect(view.answer).toBe("Lisbon, Alfama.");
    expect(view.activity.some((e) => e.kind === "thought" && e.text === "Lisbon, Alfama.")).toBe(
      false,
    );
    expect(view.estimates).toHaveLength(1);
    expect(view.usage).toEqual({ costUsd: 0.15000000000000002, turns: 5, durationMs: 1500 });
  });

  it("reports the error of a failed run", () => {
    const view = deriveJob({
      ...base,
      events: [{ kind: "status", status: "error", message: "timeout", t: 0 }],
    });
    expect(view.error).toBe("timeout");
  });
});
