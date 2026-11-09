// horizon_profile: the skyline seen from a point, from Open-Meteo elevation data
// (Copernicus DEM, 90 m), with earth curvature and standard refraction.
import { z } from "zod";
import { RESEARCH_DESCRIPTIONS } from "../tools.ts";
import { EARTH_RADIUS_M, destination } from "./geo.ts";
import { getJson } from "./http.ts";
import { ResearchError, defineTool, formatPoint, text } from "./types.ts";

const ENDPOINT = "https://api.open-meteo.com/v1/elevation";
const POINTS_PER_REQUEST = 100;
const SAMPLES_PER_BEARING = 24;
const MAX_BEARINGS = 37;
/** Standard terrestrial refraction coefficient. */
const REFRACTION = 0.13;

export const horizonSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  from_deg: z.number().min(0).max(360).describe("First bearing, clockwise from north."),
  to_deg: z.number().min(0).max(360).describe("Last bearing; the range runs clockwise."),
  step_deg: z.number().min(1).max(30).optional().describe("Default 5."),
  max_km: z.number().min(2).max(80).optional().describe("Farthest terrain considered, default 40."),
  eye_m: z.number().min(0).max(500).optional().describe("Camera height above ground, default 2."),
});

/** Bearings from `from` to `to` clockwise, capped so one call stays a few requests. */
export function bearings(from: number, to: number, step: number): number[] {
  const span = (to - from + 360) % 360 || 360;
  const count = Math.min(MAX_BEARINGS, Math.floor(span / step) + 1);
  return Array.from({ length: count }, (_, i) => (from + i * step) % 360);
}

/** Sample distances in metres, denser near the viewer where small hills matter most. */
export function sampleDistances(maxKm: number): number[] {
  return Array.from({ length: SAMPLES_PER_BEARING }, (_, i) => {
    const f = (i + 1) / SAMPLES_PER_BEARING;
    return 150 + (maxKm * 1000 - 150) * f * f;
  });
}

/** Apparent elevation angle of terrain at `distance`, in degrees. */
export function elevationAngle(eyeAltitude: number, terrain: number, distance: number): number {
  const drop = ((1 - REFRACTION) * distance * distance) / (2 * EARTH_RADIUS_M);
  return (Math.atan2(terrain - drop - eyeAltitude, distance) * 180) / Math.PI;
}

async function elevations(
  points: Array<{ lat: number; lng: number }>,
  ctx: Parameters<typeof getJson>[1],
): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += POINTS_PER_REQUEST) {
    const chunk = points.slice(i, i + POINTS_PER_REQUEST);
    const params = new URLSearchParams({
      latitude: chunk.map((p) => p.lat.toFixed(5)).join(","),
      longitude: chunk.map((p) => p.lng.toFixed(5)).join(","),
    });
    const answer = await getJson<{ elevation?: number[] }>(`${ENDPOINT}?${params}`, ctx);
    if (answer.elevation?.length !== chunk.length)
      throw new ResearchError("elevation data incomplete");
    out.push(...answer.elevation);
  }
  return out;
}

export const horizonTool = defineTool({
  name: "horizon_profile",
  description: RESEARCH_DESCRIPTIONS.horizon_profile,
  schema: horizonSchema,
  budget: 12,
  /** The viewpoint itself: a small circle, the skyline reaches far beyond. */
  probe: ({ lat, lng }) => ({ lat, lng, radius_m: 100 }),
  describe: ({ lat, lng, from_deg, to_deg }) =>
    `${formatPoint(lat, lng)} · ${Math.round(from_deg)}°–${Math.round(to_deg)}°`,
  async run(input, ctx) {
    const list = bearings(input.from_deg, input.to_deg, input.step_deg ?? 5);
    const distances = sampleDistances(input.max_km ?? 40);
    const points = [
      { lat: input.lat, lng: input.lng },
      ...list.flatMap((b) => distances.map((d) => destination(input.lat, input.lng, b, d))),
    ];
    const [ground = 0, ...terrain] = await elevations(points, ctx);
    const eye = ground + (input.eye_m ?? 2);
    const lines = list.map((bearing, b) => {
      let best = { angle: -90, distance: 0, altitude: 0 };
      for (const [s, distance] of distances.entries()) {
        const altitude = terrain[b * distances.length + s] ?? 0;
        const angle = elevationAngle(eye, altitude, distance);
        if (angle > best.angle) best = { angle, distance, altitude };
      }
      const sign = best.angle >= 0 ? "+" : "";
      return `${String(Math.round(bearing)).padStart(3, "0")}°: ${sign}${best.angle.toFixed(2)}° at ${(best.distance / 1000).toFixed(1)} km (terrain ${Math.round(best.altitude)} m)`;
    });
    return [
      text(
        `Viewpoint ${formatPoint(input.lat, input.lng)}, ground ${Math.round(ground)} m, eye ${Math.round(eye)} m. Highest terrain per bearing (elevation angle above the horizontal):\n${lines.join("\n")}`,
      ),
    ];
  },
});
