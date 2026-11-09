// Content Security Policy of the production server. Map tiles are the only
// third-party origins; they are required by the satellite map.
export const TILE_ORIGINS = ["https://server.arcgisonline.com", "https://*.basemaps.cartocdn.com"];

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Leaflet positions tiles and markers through inline style attributes.
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${TILE_ORIGINS.join(" ")}`,
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
].join("; ");
