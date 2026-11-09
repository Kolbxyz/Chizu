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
      blockToEvent({ type: "tool_use", name: "Write", input: { file_path: "x" } }),
    ).toBeUndefined();
  });

  it("maps research tool calls to tool events", () => {
    expect(
      blockToEvent({
        type: "tool_use",
        name: "mcp__chizu__find_photos",
        input: { query: "Endingen Kirche" },
      }),
    ).toEqual({ kind: "tool", tool: "find_photos", detail: "Endingen Kirche" });
    expect(
      blockToEvent({ type: "tool_use", name: "mcp__other__find_photos", input: { query: "x" } }),
    ).toBeUndefined();
  });

  it("maps sandboxed commands and browser calls", () => {
    expect(
      blockToEvent({
        type: "tool_use",
        name: "Bash",
        input: { command: "python3 sun.py", description: "Compute sun azimuth" },
      }),
    ).toEqual({ kind: "code", detail: "Compute sun azimuth" });
    expect(
      blockToEvent({
        type: "tool_use",
        name: "mcp__chizu__street_view",
        input: { lat: 48.3, lng: 7.4, heading: 90 },
      }),
    ).toEqual({
      kind: "tool",
      tool: "street_view",
      detail: "48.30000, 7.40000 · 90°",
      at: { lat: 48.3, lng: 7.4, radius_m: 30 },
    });
  });
});
