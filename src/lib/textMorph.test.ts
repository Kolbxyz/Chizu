import { describe, expect, it } from "vitest";
import { keepRuns, matchCharacters } from "./textMorph.ts";

const chars = (s: string) => [...s];

describe("matchCharacters", () => {
  it("keeps shared letters in order", () => {
    const pairs = matchCharacters(chars("Clues"), chars("Indices"));
    const kept = pairs.map(([i]) => "Clues"[i]).join("");
    expect(kept.toLowerCase()).toBe("ces");
  });

  it("matches identical strings fully and ignores case", () => {
    expect(matchCharacters(chars("Web"), chars("web"))).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
  });

  it("handles empty input", () => {
    expect(matchCharacters([], chars("abc"))).toEqual([]);
  });

  it("drops isolated matches but keeps runs", () => {
    expect(
      keepRuns([
        [0, 0],
        [3, 5],
        [4, 6],
        [9, 8],
      ]),
    ).toEqual([
      [3, 5],
      [4, 6],
    ]);
  });
});
