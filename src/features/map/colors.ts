// Map overlay colours. Leaflet writes them into SVG attributes, which cannot
// read CSS custom properties; they match --map-* in src/styles/tokens.css.
export const MAP_COLORS = {
  best: "#ff8a5c",
  alt: "#cbbff6",
} as const;
