// find_places: OpenStreetMap features around a point through the Overpass API.
import { z } from "zod";
import { RESEARCH_DESCRIPTIONS } from "../tools.ts";
import { distanceM } from "./geo.ts";
import { getJson } from "./http.ts";
import { defineTool, formatPoint, text } from "./types.ts";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const MAX_RESULTS = 60;
/** One or more [key=value]-style filters; no statements, so the query stays a single search. */
const FILTER = /^(\[[^[\]\n;{}()]{1,150}\]){1,6}$/;
const KEPT_TAGS = [
  /^name(:(en|fr|de|es|it))?$/,
  /^(amenity|building|denomination|religion|tourism|historic|man_made|natural|shop|brand|operator|leisure|landuse|place)$/,
  /^(height|ele|levels|building:levels|roof:shape|tower:type|start_date|heritage)$/,
  /^(wikidata|wikipedia|wikimedia_commons|image|website)$/,
  /^addr:(street|housenumber|city|postcode)$/,
];

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export const placesSchema = z.object({
  filter: z.string().regex(FILTER, 'Overpass tag filters such as ["amenity"="cafe"]'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_m: z.number().min(10).max(30_000),
});

/** Overpass QL for one filtered search; exported for tests. */
export const overpassQuery = ({ filter, lat, lng, radius_m }: z.infer<typeof placesSchema>) =>
  `[out:json][timeout:25];nwr${filter}(around:${Math.round(radius_m)},${lat},${lng});out center tags ${MAX_RESULTS + 1};`;

export const placesTool = defineTool({
  name: "find_places",
  description: RESEARCH_DESCRIPTIONS.find_places,
  schema: placesSchema,
  budget: 20,
  describe: ({ filter, lat, lng, radius_m }) =>
    `${filter} · ${Math.round(radius_m)} m around ${formatPoint(lat, lng)}`,
  async run(input, ctx) {
    const answer = await getJson<{ elements?: OverpassElement[] }>(ENDPOINT, ctx, {
      form: new URLSearchParams({ data: overpassQuery(input) }),
      spacingMs: 1000,
      // The public instance queues queries under load; 25 s of query time plus waiting.
      timeoutMs: 60_000,
    });
    const elements = answer.elements ?? [];
    if (elements.length === 0) return [text("No matching feature in this area.")];
    const places = elements
      .flatMap((element) => {
        const lat = element.lat ?? element.center?.lat;
        const lng = element.lon ?? element.center?.lon;
        if (lat === undefined || lng === undefined) return [];
        const tags = Object.fromEntries(
          Object.entries(element.tags ?? {}).filter(([key]) =>
            KEPT_TAGS.some((re) => re.test(key)),
          ),
        );
        const distance = Math.round(distanceM(input.lat, input.lng, lat, lng));
        return [{ osm: `${element.type}/${element.id}`, lat, lng, distance_m: distance, tags }];
      })
      .sort((a, b) => a.distance_m - b.distance_m);
    const shown = places.slice(0, MAX_RESULTS);
    const more = places.length > MAX_RESULTS ? " (more exist: narrow the filter or radius)" : "";
    return [text(`${shown.length} features, nearest first${more}:\n${JSON.stringify(shown)}`)];
  },
});
