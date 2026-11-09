import { describe, expect, it } from "vitest";
import { parseRef, toRef } from "./types.ts";

describe("job refs", () => {
  it("round-trips an engine and an id", () => {
    expect(parseRef(toRef("api", "a1:b2"))).toEqual({ engine: "api", id: "a1:b2" });
  });

  it("rejects unknown engines and empty ids", () => {
    expect(parseRef("gpu:123")).toBeUndefined();
    expect(parseRef("cc:")).toBeUndefined();
    expect(parseRef("no-colon")).toBeUndefined();
  });
});
