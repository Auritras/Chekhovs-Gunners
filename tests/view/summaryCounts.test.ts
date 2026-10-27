import { describe, it, expect } from "vitest";
import { summaryCounts } from "@/lib/view/summaryCounts";
import type { AnalysisResult, Payoff, Setup } from "@/lib/types";

const setup = (id: string, chapter: number): Setup => ({
  id, chapter, quote: "q", start: 0, end: 1, kind: "object", summary: "", importance: 1,
});
const payoff = (id: string, chapter: number): Payoff => ({
  id, chapter, quote: "q", start: 0, end: 1, summary: "",
});

function result(over: Partial<AnalysisResult>): AnalysisResult {
  return {
    chapters: [], setups: [], payoffs: [], matches: [], unfired: [], tension: [],
    failedChapters: [], uncertain: [], droppedQuotes: 0, model: "m",
    promptVersions: { extract: "x", match: "m" }, ...over,
  };
}

describe("summaryCounts", () => {
  it("counts only uncertain setups, not uncertain payoffs, and the tiles add up", () => {
    const r = result({
      setups: [setup("s1", 1), setup("s2", 1), setup("s3", 3), setup("s4", 1)],
      payoffs: [payoff("p1", 2), payoff("p2", 4), payoff("p3", 4)],
      matches: [{ setupId: "s1", payoffId: "p1", reasoning: "", source: "match" }],
      unfired: ["s2", "s3", "s4"],
      failedChapters: [2],
      // s2 and s4 come before failed chapter 2; p2 and p3 come after it.
      uncertain: ["s2", "s4", "p2", "p3"],
    });
    const c = summaryCounts(r);
    expect(c).toEqual({ planted: 4, fired: 1, neverFired: 1, uncertain: 2 });
    expect(c.fired + c.neverFired + c.uncertain).toBe(c.planted);
  });

  it("counts a setup fired by two payoffs once", () => {
    const r = result({
      setups: [setup("s1", 1)],
      payoffs: [payoff("p1", 2), payoff("p2", 3)],
      matches: [
        { setupId: "s1", payoffId: "p1", reasoning: "", source: "match" },
        { setupId: "s1", payoffId: "p2", reasoning: "", source: "extract" },
      ],
    });
    expect(summaryCounts(r)).toEqual({ planted: 1, fired: 1, neverFired: 0, uncertain: 0 });
  });

  it("handles an empty result", () => {
    expect(summaryCounts(result({}))).toEqual({ planted: 0, fired: 0, neverFired: 0, uncertain: 0 });
  });
});
