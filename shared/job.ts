// Wire types shared by the API server and the frontend.
import type { BrowserToolName } from "./browser.ts";
import type { ResearchToolName } from "./research/types.ts";
import type { Clue, Estimate } from "./schema.ts";

export type JobStatus = "queued" | "running" | "done" | "error" | "cancelled";

export interface ExifSummary {
  lat?: number;
  lng?: number;
  altitude?: number;
  /** Compass direction the camera was pointing, in degrees. */
  heading?: number;
  takenAt?: string;
  camera?: string;
  lens?: string;
  software?: string;
}

/** Area a tool call looked at, drawn on the map while Claude checks a hypothesis. */
export interface ProbedArea {
  lat: number;
  lng: number;
  radius_m: number;
}

export interface JobImage {
  name: string;
  width: number;
  height: number;
  exif: ExifSummary;
}

interface EventBase {
  /** Milliseconds since the Unix epoch. */
  t: number;
}

export type JobEvent = EventBase &
  (
    | { kind: "status"; status: JobStatus; message?: string }
    | { kind: "clue"; clue: Clue }
    | { kind: "estimate"; estimate: Estimate }
    | { kind: "search"; query: string }
    | { kind: "fetch"; url: string }
    | { kind: "zoom"; image: number }
    /** A research tool call; `detail` is data (a query, coordinates, a host). */
    | {
        kind: "tool";
        tool: ResearchToolName | BrowserToolName;
        detail: string;
        /** Set for calls aimed at a point (satellite, Street View, searches around a point). */
        at?: ProbedArea;
      }
    /** A sandboxed command; `detail` is Claude's description of it or its first line. */
    | { kind: "code"; detail: string }
    /** A step Claude added to its plan for the run. */
    | { kind: "task"; detail: string }
    | { kind: "thought"; text: string }
    | { kind: "hint"; text: string }
    | { kind: "usage"; costUsd: number; turns: number; durationMs: number }
  );

export interface JobSummary {
  id: string;
  createdAt: number;
  status: JobStatus;
  imageCount: number;
  /** Label of the best candidate of the latest estimate, if any. */
  place?: string;
  level?: Estimate["level"];
}

export interface Job extends JobSummary {
  images: JobImage[];
  /** BCP 47 tag of the language Claude answers in. */
  locale: string;
  sessionId?: string;
  events: JobEvent[];
}
