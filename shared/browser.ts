// Browser tools of the Claude Code engine (server/browser): names and
// input schemas, shared with the page for the activity log.
import { z } from "zod";
import type { ProbedArea } from "./job.ts";

export const BROWSER_TOOL_NAMES = [
  "street_view",
  "browser_open",
  "browser_click",
  "browser_drag",
  "browser_scroll",
  "browser_type",
  "browser_key",
  "browser_read",
] as const;

export type BrowserToolName = (typeof BROWSER_TOOL_NAMES)[number];

/** Viewport of the browser; screenshots use the same pixels. */
export const VIEWPORT = { width: 1280, height: 800 } as const;

const x = z
  .number()
  .int()
  .min(0)
  .max(VIEWPORT.width - 1);
const y = z
  .number()
  .int()
  .min(0)
  .max(VIEWPORT.height - 1);
const waitMs = z
  .number()
  .int()
  .min(0)
  .max(15_000)
  .optional()
  .describe("Extra wait before the screenshot, for slow pages. Default 1500.");

export const BROWSER_SCHEMAS = {
  street_view: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    heading: z
      .number()
      .min(0)
      .max(360)
      .optional()
      .describe("Camera direction, degrees. Default 0."),
    pitch: z.number().min(-90).max(90).optional().describe("Up/down, degrees. Default 0."),
    fov: z.number().min(10).max(100).optional().describe("Field of view, degrees. Default 90."),
  }),
  browser_open: z.object({
    url: z
      .string()
      .max(2000)
      .refine((v) => URL.canParse(v) && /^https?:$/.test(new URL(v).protocol), "An http(s) URL."),
    wait_ms: waitMs,
  }),
  browser_click: z.object({ x, y, wait_ms: waitMs }),
  browser_drag: z.object({ from_x: x, from_y: y, to_x: x, to_y: y, wait_ms: waitMs }),
  browser_scroll: z.object({
    x,
    y,
    delta: z.number().int().min(-3000).max(3000).describe("Wheel delta; negative zooms maps in."),
    wait_ms: waitMs,
  }),
  browser_type: z.object({
    text: z.string().min(1).max(500),
    submit: z.boolean().optional().describe("Press Enter after typing."),
    wait_ms: waitMs,
  }),
  browser_key: z.object({
    key: z
      .string()
      .regex(/^[A-Za-z0-9+]{1,30}$/)
      .describe("Playwright key name: ArrowLeft, Escape, PageDown, Control+a…"),
    wait_ms: waitMs,
  }),
  browser_read: z.object({
    max_chars: z
      .number()
      .int()
      .min(500)
      .max(20_000)
      .optional()
      .describe("Longest text returned. Default 6000."),
  }),
} satisfies Record<BrowserToolName, z.ZodObject>;

/** Camera or map centre that a Google Maps URL records, or undefined for other pages. */
export interface MapPosition {
  lat: number;
  lng: number;
  /** Set for a Street View panorama: camera direction, degrees. */
  heading?: number;
}

const MAPS_AT =
  /^https:\/\/www\.google\.[a-z.]+\/maps\/.*@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),([^/]*)/;

export function mapPosition(url: string): MapPosition | undefined {
  const match = MAPS_AT.exec(url);
  if (!match) return undefined;
  const [, lat, lng, view = ""] = match;
  const position = { lat: Number(lat), lng: Number(lng) };
  // Street View URLs read `@lat,lng,3a,75y,20h,90t`: 'a' marks a panorama, 'h' the heading.
  const heading = /(?:^|,)(\d+(?:\.\d+)?)h(?:,|$)/.exec(view)?.[1];
  return /\da(?:,|$)/.test(view) && heading !== undefined
    ? { ...position, heading: Number(heading) }
    : position;
}

export const isBrowserTool = (name: string): name is BrowserToolName =>
  (BROWSER_TOOL_NAMES as readonly string[]).includes(name);

/** Activity-log summary of a browser call (data only), or undefined when invalid. */
export function describeBrowserCall(name: BrowserToolName, input: unknown): string | undefined {
  const parsed = BROWSER_SCHEMAS[name].safeParse(input);
  if (!parsed.success) return undefined;
  const value = parsed.data as Record<string, unknown>;
  switch (name) {
    case "street_view":
      return `${Number(value.lat).toFixed(5)}, ${Number(value.lng).toFixed(5)} · ${Math.round(Number(value.heading ?? 0))}°`;
    case "browser_open":
      return new URL(String(value.url)).host;
    case "browser_type":
      return String(value.text).slice(0, 80);
    case "browser_key":
      return String(value.key);
    default:
      return "";
  }
}

/** Google Maps URLs carry the view as `@lat,lng,` followed by a width (`400m`) or a zoom. */
const MAPS_VIEW =
  /^https:\/\/www\.google\.[a-z.]+\/maps\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(?:(\d+(?:\.\d+)?)m)?/;
const STANDING_RADIUS_M = 30;

/** Area a browser call looks at, for the map: Street View and Google Maps views. */
export function probeBrowserCall(name: BrowserToolName, input: unknown): ProbedArea | undefined {
  const parsed = BROWSER_SCHEMAS[name].safeParse(input);
  if (!parsed.success) return undefined;
  const value = parsed.data as Record<string, unknown>;
  if (name === "street_view")
    return { lat: Number(value.lat), lng: Number(value.lng), radius_m: STANDING_RADIUS_M };
  if (name !== "browser_open") return undefined;
  const view = MAPS_VIEW.exec(String(value.url));
  if (!view) return undefined;
  const width = view[3] === undefined ? undefined : Number(view[3]);
  return {
    lat: Number(view[1]),
    lng: Number(view[2]),
    radius_m: width === undefined ? STANDING_RADIUS_M : width / 2,
  };
}
