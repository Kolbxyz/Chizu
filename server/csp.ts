// Content Security Policy, served as a header by the production server and as a
// <meta> tag in static builds (vite.config.ts). Third-party origins: map tiles,
// and the Anthropic API and Nominatim for the API engine.
export const TILE_ORIGINS = ["https://server.arcgisonline.com", "https://*.basemaps.cartocdn.com"];

/** Origins the API engine calls from the browser. */
export const API_ORIGINS = ["https://api.anthropic.com", "https://nominatim.openstreetmap.org"];

const DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  // Leaflet positions tiles and markers through inline style attributes.
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${TILE_ORIGINS.join(" ")}`,
  `connect-src 'self' ${API_ORIGINS.join(" ")}`,
  // Vite inlines small font subsets as data: URLs.
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
];

export const CONTENT_SECURITY_POLICY = DIRECTIVES.join("; ");

/** The same policy for a <meta> tag (static hosting), without header-only directives. */
export const META_CONTENT_SECURITY_POLICY = DIRECTIVES.filter(
  (d) => !d.startsWith("frame-ancestors"),
).join("; ");
