import { describe, expect, it } from "vitest";
import { streetViewUrl } from "./session.ts";

describe("streetViewUrl", () => {
  it("builds a Maps URLs pano link", () => {
    const url = new URL(streetViewUrl({ lat: 48.3, lng: 7.4, heading: 271.6 }));
    expect(url.searchParams.get("map_action")).toBe("pano");
    expect(url.searchParams.get("viewpoint")).toBe("48.3,7.4");
    expect(url.searchParams.get("heading")).toBe("272");
    expect(url.searchParams.get("fov")).toBe("90");
  });
});
