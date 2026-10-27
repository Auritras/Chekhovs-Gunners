import { describe, it, expect } from "vitest";
import { highlightSegments } from "@/lib/view/highlight";

const m = (id: string, start: number, end: number, kind: "setup" | "payoff" = "setup") => ({
  id, start, end, kind, state: "x",
});

describe("highlightSegments", () => {
  it("splits a nested mark into three segments", () => {
    const text = "0123456789";
    const segs = highlightSegments(text, [m("p", 2, 8, "payoff"), m("s", 4, 6)]);
    expect(segs.map((s) => s.marks)).toEqual([[], ["p"], ["p", "s"], ["p"], []]);
    expect(segs.map((s) => s.text).join("")).toBe(text);
    expect(segs.every((s) => s.text.length > 0)).toBe(true);
  });

  it("gives three segments when the payoff spans the whole text", () => {
    const text = "abcdef";
    const segs = highlightSegments(text, [m("p", 0, 6, "payoff"), m("s", 2, 4)]);
    expect(segs.map((s) => s.marks)).toEqual([["p"], ["p", "s"], ["p"]]);
    expect(segs.map((s) => s.text).join("")).toBe(text);
  });

  it("merges identical ranges into one segment", () => {
    const segs = highlightSegments("abcdef", [m("a", 1, 3), m("b", 1, 3, "payoff")]);
    expect(segs).toEqual([
      { text: "a", marks: [] },
      { text: "bc", marks: ["a", "b"] },
      { text: "def", marks: [] },
    ]);
  });

  it("ignores empty and out-of-range marks, clamps others", () => {
    const segs = highlightSegments("abcd", [m("e", 2, 2), m("o", 10, 12), m("c", -3, 2)]);
    expect(segs).toEqual([
      { text: "ab", marks: ["c"] },
      { text: "cd", marks: [] },
    ]);
  });

  it("returns no segments for empty text and one plain segment without marks", () => {
    expect(highlightSegments("", [])).toEqual([]);
    expect(highlightSegments("hi", [])).toEqual([{ text: "hi", marks: [] }]);
  });
});
