import { describe, expect, it } from "vitest";
import { isInside } from "./viewImage.ts";

describe("isInside", () => {
  it("accepts the root and its descendants only", () => {
    expect(isInside("/w/j1", "/w/j1")).toBe(true);
    expect(isInside("/w/j1", "/w/j1/out/plot.png")).toBe(true);
    expect(isInside("/w/j1", "/w/j1-other/a.png")).toBe(false);
    expect(isInside("/w/j1", "/w/j2/a.png")).toBe(false);
    expect(isInside("/w/j1", "/etc/passwd")).toBe(false);
  });
});
