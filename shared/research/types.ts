// Contract between the research tools and the engines that run them. Tools
// return text and image URLs; each engine turns image URLs into what its
// Claude transport accepts (base64 for Claude Code, URL sources for the API).
import type { z } from "zod";
import type { ProbedArea } from "../job.ts";

export type ResearchPart = { type: "text"; text: string } | { type: "image"; url: string };

export interface ResearchContext {
  signal: AbortSignal;
  /** Added to every request: the server identifies itself; browsers set their own agent. */
  headers: Record<string, string>;
}

/** Expected failure (bad input, no data, unreachable service), reported to Claude as a tool error. */
export class ResearchError extends Error {}

export const RESEARCH_TOOL_NAMES = [
  "geocode",
  "find_places",
  "find_photos",
  "fetch_image",
  "satellite_view",
  "horizon_profile",
] as const;

export type ResearchToolName = (typeof RESEARCH_TOOL_NAMES)[number];

export interface ResearchTool<S extends z.ZodObject = z.ZodObject> {
  name: ResearchToolName;
  description: string;
  schema: S;
  /** Calls allowed per run; later calls are refused so the run moves on. */
  budget: number;
  /** Short, data-only summary of a call for the activity log (a query, coordinates, a host). */
  describe(input: z.infer<S>): string;
  /** Area the call looks at, when it is aimed at a point. */
  probe?(input: z.infer<S>): ProbedArea | undefined;
  run(input: z.infer<S>, ctx: ResearchContext): Promise<ResearchPart[]>;
}

/** Erases the input type so tools with different schemas share one registry. */
export const defineTool = <S extends z.ZodObject>(tool: ResearchTool<S>) =>
  tool as unknown as ResearchTool;

export const text = (value: string): ResearchPart => ({ type: "text", text: value });

/** Rounds coordinates for display: 5 decimals is about one metre. */
export const formatPoint = (lat: number, lng: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
