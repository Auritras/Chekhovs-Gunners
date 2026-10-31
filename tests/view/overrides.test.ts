import { describe, it, expect } from "vitest";
import { activeOverrides, payoffPassage, storyKey, withWriterGuns } from "@/lib/view/overrides";
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

describe("payoffPassage", () => {
  const text = "  The gun hung there.  Later she fired it.  ";
  const setup = { chapter: 1, end: 21 };
  it("trims whitespace and returns the quote", () => {
    const a = text.indexOf("Later") - 2;
    const b = text.indexOf("it.") + 3 + 2;
    expect(payoffPassage(text, a, b, setup, 1)).toEqual({
      start: text.indexOf("Later"),
      end: text.indexOf("it.") + 3,
      quote: "Later she fired it.",
    });
  });
  it("rejects an empty selection and one before the setup", () => {
    expect(payoffPassage(text, 0, 2, setup, 1)).toHaveProperty("error");
    expect(payoffPassage(text, 2, 10, setup, 1)).toHaveProperty("error");
    expect(payoffPassage(text, 2, 10, setup, 2)).toHaveProperty("quote");
  });
});

describe("withWriterGuns", () => {
  it("adds valid writer guns as unfired setups and drops ones whose text no longer matches", () => {
    const r = result({});
    const out = withWriterGuns(r, [
      { id: "writer-gun-a", chapter: 1, start: 2, end: 5, quote: "gun", summary: "the gun" },
      { id: "writer-gun-b", chapter: 1, start: 0, end: 3, quote: "xyz", summary: "stale" },
    ]);
    expect(out.setups.map((s) => s.id)).toEqual(["writer-gun-a"]);
    expect(out.unfired).toEqual(["writer-gun-a"]);
    expect(withWriterGuns(r, [])).toBe(r);
  });
});
