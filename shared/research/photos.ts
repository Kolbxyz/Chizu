// find_photos: Wikimedia Commons file search, by words and/or by distance to a point.
import { z } from "zod";
import { RESEARCH_DESCRIPTIONS } from "../tools.ts";
import { distanceM } from "./geo.ts";
import { getJson } from "./http.ts";
import { defineTool, formatPoint, text, type ResearchPart } from "./types.ts";

const ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Orthophoto tiles and maps match location searches but show nothing at eye level. */
const NOT_A_PHOTO = /\b(DOP|orthophoto|map|karte|carte|plan|wappen|coat of arms)\b/i;

interface CommonsPage {
  title: string;
  index?: number;
  coordinates?: Array<{ lat: number; lon: number }>;
  imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string }>;
}

export const photosSchema = z
  .object({
    query: z.string().min(1).max(200).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    radius_m: z.number().min(50).max(20_000).optional(),
    show: z.number().int().min(1).max(6).optional().describe("Images to show, default 4."),
  })
  .refine((v) => v.query !== undefined || (v.lat !== undefined && v.lng !== undefined), {
    message: "Give a query, a point (lat and lng), or both.",
  });

/** CirrusSearch expression (nearcoord takes whole units only); exported for tests. */
export function commonsSearch({ query, lat, lng, radius_m }: z.infer<typeof photosSchema>): string {
  const near =
    lat !== undefined && lng !== undefined
      ? `nearcoord:${Math.round(radius_m ?? 2000)}m,${lat},${lng}`
      : "";
  return [query, near].filter(Boolean).join(" ");
}

export const photosTool = defineTool({
  name: "find_photos",
  description: RESEARCH_DESCRIPTIONS.find_photos,
  schema: photosSchema,
  budget: 25,
  describe: (input) =>
    [
      input.query,
      input.lat !== undefined && input.lng !== undefined ? formatPoint(input.lat, input.lng) : "",
    ]
      .filter(Boolean)
      .join(" · "),
  async run(input, ctx) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      generator: "search",
      gsrnamespace: "6",
      gsrlimit: "30",
      gsrsearch: commonsSearch(input),
      prop: "imageinfo|coordinates",
      iiprop: "url|mime",
      iiurlwidth: "1024",
    });
    const answer = await getJson<{ query?: { pages?: Record<string, CommonsPage> } }>(
      `${ENDPOINT}?${params}`,
      ctx,
    );
    const photos = Object.values(answer.query?.pages ?? {})
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .flatMap((page) => {
        const info = page.imageinfo?.[0];
        const url = info?.thumburl ?? info?.url;
        if (!url || !PHOTO_MIME.has(info?.mime ?? "") || NOT_A_PHOTO.test(page.title)) return [];
        const at = page.coordinates?.[0];
        const distance =
          at && input.lat !== undefined && input.lng !== undefined
            ? Math.round(distanceM(input.lat, input.lng, at.lat, at.lon))
            : undefined;
        return [{ title: page.title.replace(/^File:/, ""), url, at, distance }];
      });
    if (photos.length === 0) return [text("No photo found. Try other words or a larger radius.")];

    const show = input.show ?? 4;
    const lines = photos.map((photo, i) => {
      const where = photo.at ? ` · ${formatPoint(photo.at.lat, photo.at.lon)}` : "";
      const away = photo.distance !== undefined ? ` · ${photo.distance} m away` : "";
      const link = i < show ? " (shown below)" : ` · ${photo.url}`;
      return `[${i + 1}] ${photo.title}${where}${away}${link}`;
    });
    const parts: ResearchPart[] = [
      text(`${photos.length} photos on Wikimedia Commons:\n${lines.join("\n")}`),
    ];
    for (const [i, photo] of photos.slice(0, show).entries()) {
      parts.push(text(`[${i + 1}] ${photo.title}`), { type: "image", url: photo.url });
    }
    return parts;
  },
});
