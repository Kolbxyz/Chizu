// OpenStreetMap Nominatim lookups for the geocode tool. The usage policy allows
// at most one request per second; calls are spaced accordingly.
const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const MIN_INTERVAL_MS = 1100;
let last: Promise<unknown> = Promise.resolve();

export function nominatimUrl(query: string): string {
  return `${ENDPOINT}?${new URLSearchParams({ format: "jsonv2", limit: "5", q: query })}`;
}

/** Returns a compact JSON list of matches for Claude. */
export function geocode(query: string, signal: AbortSignal): Promise<string> {
  const request = last.then(async () => {
    const response = await fetch(nominatimUrl(query), {
      signal,
      headers: { "accept-language": "en" },
    });
    if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
    const results = (await response.json()) as Array<Record<string, unknown>>;
    return JSON.stringify(
      results.map((r) => ({
        name: r.display_name,
        lat: Number(r.lat),
        lng: Number(r.lon),
        kind: `${String(r.category ?? r.class)}/${String(r.type)}`,
      })),
    );
  });
  last = request
    .catch(() => undefined)
    .then(() => new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS)));
  return request;
}
