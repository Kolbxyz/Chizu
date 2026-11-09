import { describe, expect, it } from "vitest";
import { mapPosition, probeBrowserCall } from "./browser.ts";

describe("mapPosition", () => {
  it("reads a Street View panorama position and heading", () => {
    const url =
      "https://www.google.com/maps/@48.1392128,7.3250712,3a,75y,20.5h,90t/data=!3m7!1e1!3m5!1sPd1X";
    expect(mapPosition(url)).toEqual({ lat: 48.1392128, lng: 7.3250712, heading: 20.5 });
  });

  it("reads a map centre without heading", () => {
    expect(mapPosition("https://www.google.fr/maps/@48.14,7.32,15z")).toEqual({
      lat: 48.14,
      lng: 7.32,
    });
    expect(
      mapPosition("https://www.google.com/maps/place/X/@-33.9,151.2,500m/data=!3m1!1e3"),
    ).toEqual({
      lat: -33.9,
      lng: 151.2,
    });
  });

  it("ignores other pages", () => {
    expect(mapPosition("https://example.com/maps/@1,2,3z")).toBeUndefined();
  });
});

describe("probeBrowserCall", () => {
  it("marks where Street View stands and where a Maps view is centred", () => {
    expect(probeBrowserCall("street_view", { lat: 48.3, lng: 7.4 })).toEqual({
      lat: 48.3,
      lng: 7.4,
      radius_m: 30,
    });
    expect(
      probeBrowserCall("browser_open", {
        url: "https://www.google.com/maps/@48.3226,7.4273,400m/data=!3m1!1e3",
      }),
    ).toEqual({ lat: 48.3226, lng: 7.4273, radius_m: 200 });
  });

  it("ignores pages and actions without a position", () => {
    expect(probeBrowserCall("browser_open", { url: "https://example.com/" })).toBeUndefined();
    expect(probeBrowserCall("browser_click", { x: 1, y: 1 })).toBeUndefined();
  });
});
