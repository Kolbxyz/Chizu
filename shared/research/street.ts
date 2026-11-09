// street_level: nearest Mapillary photos to a point. Needs the user's client token.
import { z } from "zod";
import { RESEARCH_DESCRIPTIONS, STREET_LEVEL_OFF } from "../tools.ts";
import { angleBetween, bbox, bearingDeg, distanceM } from "./geo.ts";
import { getJson } from "./http.ts";
import { ResearchError, defineTool, formatPoint, text, type ResearchPart } from "./types.ts";

const ENDPOINT = "https://graph.mapillary.com/images";
const FIELDS =
  "id,captured_at,compass_angle,computed_compass_angle,computed_geometry,thumb_1024_url,is_pano";

interface MapillaryImage {
  id: string;
  captured_at?: number;
  compass_angle?: number;
  computed_compass_angle?: number;
  computed_geometry?: { coordinates: [number, number] };
  thumb_1024_url?: string;
  is_pano?: boolean;
}

export const streetSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_m: z.number().min(10).max(300).optional().describe("Search radius, default 100 m."),
  heading: z.number().min(0).max(360).optional().describe("Preferred camera direction, degrees."),
  show: z.number().int().min(1).max(4).optional().describe("Images to show, default 2."),
});

export const streetTool = defineTool({
  name: "street_level",
  description: RESEARCH_DESCRIPTIONS.street_level,
  schema: streetSchema,
  budget: 20,
  describe: ({ lat, lng, heading }) =>
    heading === undefined
      ? formatPoint(lat, lng)
      : `${formatPoint(lat, lng)} · ${Math.round(heading)}°`,
  async run(input, ctx) {
    if (!ctx.mapillaryToken) throw new ResearchError(STREET_LEVEL_OFF);
    const params = new URLSearchParams({
      access_token: ctx.mapillaryToken,
      fields: FIELDS,
      bbox: bbox(input.lat, input.lng, input.radius_m ?? 100)
        .map((v) => v.toFixed(6))
        .join(","),
      limit: "100",
    });
    // The URL carries the token; getJson errors name the host only.
    const answer = await getJson<{ data?: MapillaryImage[] }>(`${ENDPOINT}?${params}`, ctx);
    const images = (answer.data ?? []).flatMap((image) => {
      const at = image.computed_geometry?.coordinates;
      if (!at || !image.thumb_1024_url) return [];
      const [lng, lat] = at;
      const heading = image.computed_compass_angle ?? image.compass_angle;
      const distance = distanceM(input.lat, input.lng, lat, lng);
      // A photo facing away from the wanted direction ranks as if 100 m further.
      const offAxis =
        input.heading !== undefined && heading !== undefined
          ? angleBetween(heading, input.heading)
          : 0;
      return [{ image, lat, lng, heading, distance, score: distance + (offAxis / 180) * 100 }];
    });
    if (images.length === 0)
      return [text("No Mapillary photo within this radius. Try a larger radius or a nearby road.")];
    images.sort((a, b) => a.score - b.score);

    const parts: ResearchPart[] = [
      text(`${images.length} Mapillary photos in the area; nearest shown:`),
    ];
    for (const found of images.slice(0, input.show ?? 2)) {
      const facing = found.heading === undefined ? "unknown" : `${Math.round(found.heading)}°`;
      const date = found.image.captured_at
        ? new Date(found.image.captured_at).toISOString().slice(0, 10)
        : "unknown date";
      const from = Math.round(bearingDeg(input.lat, input.lng, found.lat, found.lng));
      parts.push(
        text(
          `Taken ${date} at ${formatPoint(found.lat, found.lng)} (${Math.round(found.distance)} m, bearing ${from}° from the point), camera facing ${facing}${found.image.is_pano ? ", 360° panorama" : ""}.`,
        ),
        { type: "image", url: found.image.thumb_1024_url ?? "" },
      );
    }
    return parts;
  },
});
