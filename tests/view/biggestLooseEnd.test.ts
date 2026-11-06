import { describe, expect, it } from "vitest";
import { biggestLooseEnd } from "@/lib/view/biggestLooseEnd";
import type { AnalysisResult, Setup } from "@/lib/types";

const gun = (id: string, chapter: number, importance: 1 | 2 | 3, start = 0): Setup => ({
  id, chapter, importance, start, end: start + 1, quote: "q", kind: "object", summary: id,
});

const result = (setups: Setup[], unfired: string[], uncertain: string[] = []): AnalysisResult => ({
  chapters: [], setups, payoffs: [], matches: [], unfired, uncertain,
  tension: [], failedChapters: [], droppedQuotes: 0, model: "m", promptVersions: { extract: "x", match: "m" },
});

describe("biggestLooseEnd", () => {
  it("picks the most important unfired gun, then the earliest planted", () => {
    const r = result([gun("minor", 1, 1), gun("late", 3, 3), gun("early", 2, 3)], ["minor", "late", "early"]);
    expect(biggestLooseEnd(r, {})?.id).toBe("early");
  });

  it("skips guns the writer ruled on, and prefers sure ones over uncertain", () => {
    const r = result([gun("a", 1, 3), gun("b", 1, 3, 5), gun("c", 2, 1)], ["a", "b", "c"], ["b"]);
    expect(biggestLooseEnd(r, { a: { kind: "dismissed" } })?.id).toBe("c");
    expect(biggestLooseEnd(r, { a: { kind: "dismissed" }, c: { kind: "fired", chapter: 3 } })?.id).toBe("b");
  });

  it("is null when every gun fires", () => {
    expect(biggestLooseEnd(result([gun("a", 1, 3)], []), {})).toBeNull();
  });
});
