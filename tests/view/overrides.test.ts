import { describe, it, expect } from "vitest";
import { activeOverrides, storyKey } from "@/lib/view/overrides";
import type { AnalysisResult } from "@/lib/types";

function result(over: Partial<AnalysisResult>): AnalysisResult {
  return {
    chapters: [{ index: 1, title: "One", text: "A gun on the wall." }],
    setups: [], payoffs: [], matches: [], unfired: [], tension: [],
    failedChapters: [], uncertain: [], droppedQuotes: 0, model: "m",
    promptVersions: { extract: "x", match: "m" }, ...over,
  };
}

describe("storyKey", () => {
  it("is stable for the same text and changes when the text changes", () => {
    expect(storyKey(result({}))).toBe(storyKey(result({})));
    const edited = result({ chapters: [{ index: 1, title: "One", text: "A gun on the wall!" }] });
    expect(storyKey(edited)).not.toBe(storyKey(result({})));
  });
});

describe("activeOverrides", () => {
  it("keeps calls only for guns the tool left unfired", () => {
    const r = result({
      unfired: ["s2"],
      uncertain: ["s3"],
      matches: [{ setupId: "s1", payoffId: "p1", reasoning: "", source: "match" }],
    });
    const o = activeOverrides(r, {
      s1: { kind: "dismissed" },
      s2: { kind: "fired", chapter: 2 },
      s3: { kind: "dismissed" },
      gone: { kind: "dismissed" },
    });
    expect(Object.keys(o).sort()).toEqual(["s2", "s3"]);
  });
});
