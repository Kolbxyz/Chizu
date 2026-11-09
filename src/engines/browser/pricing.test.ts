import { describe, expect, it } from "vitest";
import { emptyUsage, estimateCost } from "./pricing.ts";

describe("estimateCost", () => {
  it("prices every token class and web searches", () => {
    const usage = {
      input: 1_000_000,
      output: 100_000,
      cacheWrite: 200_000,
      cacheRead: 1_000_000,
      webSearches: 3,
    };
    // 4 + 2 + 1 + 0.2 + 0.03
    expect(estimateCost("claude-opus-5-5", usage)).toBeCloseTo(7.23, 6);
    expect(estimateCost("claude-sonnet-5-5", usage)).toBeCloseTo(3.73, 6);
  });

  it("is zero for an empty run", () => {
    expect(estimateCost("claude-opus-5-5", emptyUsage())).toBe(0);
  });
});
