// Descriptions and replies of the reporting tools, shared by the MCP server
// (Claude Code engine) and the browser API engine.
import type { PrecisionLevel } from "./schema.ts";

export const TOOL_DESCRIPTIONS = {
  clue: "Record one visual or metadata observation as soon as it is noticed. Call it for every meaningful clue.",
  estimate:
    "Publish the current location estimate to the map. The first call must be at country level or coarser. Call it again at each finer level you reach (region or city, then district or street, then exact), so the user sees the area narrow down.",
  zoom: "Return a full-resolution crop of one photo to read small text, signs, plates or details. Coordinates are fractions of the image (0 = left/top, 1 = right/bottom).",
} as const;

export const CLUE_REPLY = "Clue recorded.";

const FINE_LEVELS: ReadonlySet<PrecisionLevel> = new Set(["street", "exact"]);

/** Reply to report_estimate; at street level and finer it asks for verified coordinates. */
export function estimateReply(level: PrecisionLevel): string {
  return FINE_LEVELS.has(level)
    ? "Shown on the map. Street-level and exact coordinates must come from a lookup (Nominatim, map data, a website), not from memory. If these were not verified, verify them now and publish the corrected estimate."
    : "Shown on the map. Keep refining and publish the next finer level.";
}
