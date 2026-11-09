// geocode: OpenStreetMap Nominatim lookups. The usage policy allows at most one
// request per second, so calls are spaced accordingly.
import { z } from "zod";
import { RESEARCH_DESCRIPTIONS } from "../tools.ts";
import { getJson } from "./http.ts";
import { defineTool, text } from "./types.ts";

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

interface NominatimResult {
  display_name?: string;
  lat?: string;
  lon?: string;
  category?: string;
  class?: string;
  type?: string;
}

export const geocodeTool = defineTool({
  name: "geocode",
  description: RESEARCH_DESCRIPTIONS.geocode,
  schema: z.object({ query: z.string().min(1).max(300) }),
  budget: 40,
  describe: ({ query }) => query,
  async run({ query }, ctx) {
    const url = `${ENDPOINT}?${new URLSearchParams({ format: "jsonv2", limit: "5", q: query })}`;
    const results = await getJson<NominatimResult[]>(
      url,
      { ...ctx, headers: { ...ctx.headers, "accept-language": "en" } },
      { spacingMs: 1100 },
    );
    if (results.length === 0) return [text(`No match for "${query}".`)];
    const matches = results.map((r) => ({
      name: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
      kind: `${r.category ?? r.class}/${r.type}`,
    }));
    return [text(JSON.stringify(matches))];
  },
});
