// Map overlay colours. Leaflet writes them into SVG attributes, which cannot
// read CSS custom properties; they match --map-* in src/styles/tokens.css.
export const MAP_COLORS = {
  low: "#ff5a5a",
  mid: "#ff9b42",
  high: "#ffd23f",
  probe: "#3ddc84",
} as const;

export type ConfidenceBand = "low" | "mid" | "high";

/** Colour band of a hypothesis: red below 30%, orange below 60%, gold above. */
export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence < 0.3) return "low";
  return confidence < 0.6 ? "mid" : "high";
}
