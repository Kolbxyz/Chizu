import { describe, expect, it } from "vitest";
import { REPEAT_NOTICE } from "../tools.ts";
import { bearingDeg, destination, distanceM } from "./geo.ts";
import { bearings, elevationAngle, sampleDistances } from "./horizon.ts";
import { commonsSearch, photosSchema } from "./photos.ts";
import { overpassQuery, placesSchema } from "./places.ts";
import { satelliteUrl } from "./satellite.ts";
import { ResearchSession, describeCall, probeCall } from "./session.ts";

const ctx = { signal: new AbortController().signal, headers: {} };

describe("geo", () => {
  it("travels and measures consistently", () => {
    const end = destination(48.14, 7.7, 90, 10_000);
    expect(distanceM(48.14, 7.7, end.lat, end.lng)).toBeCloseTo(10_000, 0);
    expect(bearingDeg(48.14, 7.7, end.lat, end.lng)).toBeCloseTo(90, 0);
  });
});

describe("horizon_profile", () => {
  it("lists bearings clockwise across north", () => {
    expect(bearings(350, 10, 5)).toEqual([350, 355, 0, 5, 10]);
    expect(bearings(0, 360, 1)).toHaveLength(37);
  });

  it("samples up to the farthest distance", () => {
    const distances = sampleDistances(40);
    expect(distances.at(-1)).toBeCloseTo(40_000);
    expect(distances[0]).toBeGreaterThan(150);
  });

  it("lowers far terrain for earth curvature", () => {
    expect(elevationAngle(100, 100, 1000)).toBeCloseTo(0, 1);
    // At 50 km curvature hides about 170 m, so a same-altitude ridge sits below the horizontal.
    expect(elevationAngle(100, 100, 50_000)).toBeLessThan(-0.1);
    expect(elevationAngle(200, 1200, 10_000)).toBeGreaterThan(5);
  });
});

describe("find_places", () => {
  it("accepts tag filters and rejects extra statements", () => {
    const base = { lat: 48.1, lng: 7.7, radius_m: 1000 };
    expect(
      placesSchema.safeParse({ ...base, filter: '["amenity"="place_of_worship"]' }).success,
    ).toBe(true);
    expect(placesSchema.safeParse({ ...base, filter: '["name"~"Martin",i]' }).success).toBe(true);
    expect(placesSchema.safeParse({ ...base, filter: '["a"="b"];out;node(1)' }).success).toBe(
      false,
    );
    expect(placesSchema.safeParse({ ...base, filter: "amenity=cafe" }).success).toBe(false);
  });

  it("builds an around query", () => {
    const query = overpassQuery({
      filter: '["man_made"="tower"]',
      lat: 48.1,
      lng: 7.7,
      radius_m: 2500,
    });
    expect(query).toContain('nwr["man_made"="tower"](around:2500,48.1,7.7)');
  });
});

describe("find_photos", () => {
  it("needs words or a point", () => {
    expect(photosSchema.safeParse({}).success).toBe(false);
    expect(photosSchema.safeParse({ lat: 1 }).success).toBe(false);
    expect(photosSchema.safeParse({ query: "Kirche" }).success).toBe(true);
  });

  it("combines words and distance", () => {
    expect(commonsSearch({ query: "Kirche", lat: 48.1, lng: 7.7, radius_m: 3000 })).toBe(
      "Kirche nearcoord:3000m,48.1,7.7",
    );
  });
});

describe("satellite_view", () => {
  it("requests a square in Web Mercator around the point", () => {
    const url = new URL(satelliteUrl({ lat: 0, lng: 0, span_m: 1000 }));
    const [west, south, east, north] = (url.searchParams.get("bbox") ?? "").split(",").map(Number);
    expect(east! - west!).toBeCloseTo(1000, 0);
    expect(north! - south!).toBeCloseTo(1000, 0);
    expect(url.searchParams.get("f")).toBe("image");
  });
});

describe("ResearchSession", () => {
  it("repeats an identical call from memory", async () => {
    const session = new ResearchSession(ctx);
    const input = { url: "https://upload.wikimedia.org/a.jpg" };
    const first = await session.call("fetch_image", input);
    const second = await session.call("fetch_image", input);
    expect(first.parts).toEqual([{ type: "image", url: input.url }]);
    expect(second.parts[0]).toEqual({ type: "text", text: REPEAT_NOTICE });
  });

  it("refuses invalid input and calls past the budget", async () => {
    const session = new ResearchSession(ctx);
    expect((await session.call("fetch_image", { url: "http://example.com/a.jpg" })).isError).toBe(
      true,
    );
    for (let i = 0; i < 40; i += 1)
      await session.call("fetch_image", { url: `https://a.org/${i}.jpg` });
    const over = await session.call("fetch_image", { url: "https://a.org/last.jpg" });
    expect(over.isError).toBe(true);
  });

  it("describes calls with data only", () => {
    expect(describeCall("fetch_image", { url: "https://upload.wikimedia.org/x.jpg" })).toBe(
      "upload.wikimedia.org",
    );
    expect(describeCall("geocode", { query: "" })).toBeUndefined();
  });

  it("reports the area a call looks at", () => {
    expect(probeCall("satellite_view", { lat: 48, lng: 7, span_m: 800 })).toEqual({
      lat: 48,
      lng: 7,
      radius_m: 400,
    });
    expect(probeCall("find_photos", { query: "Kirche" })).toBeUndefined();
    expect(probeCall("geocode", { query: "Endingen" })).toBeUndefined();
  });
});
