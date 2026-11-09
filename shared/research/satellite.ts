// satellite_view: one north-up image from the Esri World Imagery export service,
// the provider the map already uses.
import { z } from "zod";
import { RESEARCH_DESCRIPTIONS } from "../tools.ts";
import { defineTool, formatPoint, text } from "./types.ts";

const ENDPOINT =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export";
const SIZE_PX = 1024;
/** Web Mercator half-circumference, metres. */
const HALF_WORLD = 20_037_508.34;

export const satelliteSchema = z.object({
  lat: z.number().min(-85).max(85),
  lng: z.number().min(-180).max(180),
  span_m: z.number().min(60).max(30_000).describe("Ground width shown, in metres."),
});

/** Export URL for a square of `span_m` ground metres; exported for tests. */
export function satelliteUrl({ lat, lng, span_m }: z.infer<typeof satelliteSchema>): string {
  const x = (lng * HALF_WORLD) / 180;
  const y = (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * HALF_WORLD) / Math.PI;
  // Mercator metres grow with latitude; scale the ground span to keep it true.
  const half = span_m / 2 / Math.cos((lat * Math.PI) / 180);
  const params = new URLSearchParams({
    bbox: [x - half, y - half, x + half, y + half].map((v) => v.toFixed(1)).join(","),
    bboxSR: "3857",
    imageSR: "3857",
    size: `${SIZE_PX},${SIZE_PX}`,
    format: "jpg",
    f: "image",
  });
  return `${ENDPOINT}?${params}`;
}

export const satelliteTool = defineTool({
  name: "satellite_view",
  description: RESEARCH_DESCRIPTIONS.satellite_view,
  schema: satelliteSchema,
  budget: 25,
  probe: ({ lat, lng, span_m }) => ({ lat, lng, radius_m: span_m / 2 }),
  describe: ({ lat, lng, span_m }) => `${formatPoint(lat, lng)} · ${Math.round(span_m)} m`,
  run: async (input) => [
    text(
      `Esri World Imagery, north up, ${Math.round(input.span_m)} m across (${(input.span_m / SIZE_PX).toFixed(2)} m per pixel), centred on ${formatPoint(input.lat, input.lng)}. Imagery date varies by area.`,
    ),
    { type: "image", url: satelliteUrl(input) },
  ],
});
