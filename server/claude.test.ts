import { describe, expect, it } from "vitest";
import { blockToEvent } from "./claude.ts";

const estimate = {
  level: "city",
  candidates: [
    { id: "lisbon", label: "Lisbon", lat: 38.72, lng: -9.14, radius_m: 8000, confidence: 0.7 },
  ],
  summary: "Portuguese signs and calçada pavement.",
};

describe("blockToEvent", () => {
  it("maps a valid estimate tool call", () => {
    expect(
      blockToEvent({ type: "tool_use", name: "mcp__chizu__report_estimate", input: estimate }),
    ).toEqual({
      kind: "estimate",
      estimate,
    });
  });

  it("drops an estimate that violates the schema", () => {
    const invalid = { ...estimate, candidates: [{ ...estimate.candidates[0], lat: 120 }] };
    expect(
      blockToEvent({ type: "tool_use", name: "mcp__chizu__report_estimate", input: invalid }),
    ).toBeUndefined();
  });

  it("maps web activity and text", () => {
    expect(
      blockToEvent({ type: "tool_use", name: "WebSearch", input: { query: "calçada" } }),
    ).toEqual({
      kind: "search",
      query: "calçada",
    });
    expect(blockToEvent({ type: "text", text: "  Found it.  " })).toEqual({
      kind: "thought",
      text: "Found it.",
    });
    expect(blockToEvent({ type: "text", text: "   " })).toBeUndefined();
  });

  it("ignores unknown tools", () => {
    expect(
      blockToEvent({ type: "tool_use", name: "Bash", input: { command: "ls" } }),
    ).toBeUndefined();
  });
});
