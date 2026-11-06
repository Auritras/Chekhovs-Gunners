import { describe, expect, it } from "vitest";
import { rhythm, rhythmNote, type RhythmRow } from "@/lib/view/rhythm";
import type { AnalysisResult, Setup } from "@/lib/types";

const gun = (id: string, chapter: number): Setup => ({
  id, chapter, start: 0, end: 1, quote: "q", kind: "object", summary: id, importance: 2,
});

describe("rhythm", () => {
  it("counts guns planted and shots landing per chapter, with the writer's calls", () => {
    const r: AnalysisResult = {
      chapters: [1, 2, 3].map((index) => ({ index, title: "", text: "" })),
      setups: [gun("a", 1), gun("b", 1), gun("c", 2)],
      payoffs: [{ id: "p", chapter: 3, quote: "x", start: 0, end: 1, summary: "x" }],
      matches: [{ setupId: "a", payoffId: "p", reasoning: "", source: "match" }],
      unfired: ["b", "c"], tension: [], failedChapters: [], uncertain: [], droppedQuotes: 0, model: "m",
      promptVersions: { extract: "x", match: "m" },
    };
    const rows = rhythm(r, { b: { kind: "fired", chapter: 2 }, c: { kind: "dismissed" } });
    expect(rows).toEqual([
      { chapter: 1, planted: 2, fired: 0 },
      { chapter: 2, planted: 0, fired: 1 },
      { chapter: 3, planted: 0, fired: 1 },
    ]);
  });
});

describe("rhythmNote", () => {
  const rows = (pairs: [number, number][]): RhythmRow[] => pairs.map(([planted, fired], i) => ({ chapter: i + 1, planted, fired }));
  it("spots a rushed ending, late planting and a front-loaded story", () => {
    expect(rhythmNote(rows([[3, 0], [1, 1], [0, 3]]))).toMatch(/rushed/);
    expect(rhythmNote(rows([[1, 0], [1, 1], [1, 1], [0, 1], [3, 0], [0, 1]]))).toMatch(/last third/);
    expect(rhythmNote(rows([[3, 0], [2, 1], [0, 1], [0, 1], [0, 1]]))).toMatch(/front-loaded/);
    expect(rhythmNote(rows([[1, 0], [1, 1], [1, 1], [1, 1], [0, 1], [0, 1]]))).toMatch(/spread/);
  });
  it("says nothing about a very short or empty story", () => {
    expect(rhythmNote(rows([[1, 0], [0, 1]]))).toBeNull();
  });
});
