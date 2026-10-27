import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { scoreRun, type AnswerKey } from "@/lib/metrics";
import { chapterize } from "@/lib/chapterize";
import type { AnalysisResult, Payoff, Setup } from "@/lib/types";

const key: AnswerKey = {
  setups: [
    { id: "a", chapter: 1, quoteHint: "the brass key hung round her neck on a green ribbon", payoffChapter: 3 },
    { id: "b", chapter: 1, quoteHint: "the clock was eleven minutes fast all her childhood", payoffChapter: 4 },
    { id: "c", chapter: 2, quoteHint: "he whistled three notes at dusk every single evening", payoffChapter: 4 },
    { id: "d", chapter: 1, quoteHint: "the flare gun was kept loaded for emergencies at sea", payoffChapter: null },
  ],
};

const setup = (id: string, chapter: number, quote: string): Setup => ({
  id, chapter, quote, start: 0, end: quote.length, kind: "object", summary: id, importance: 2,
});
const payoff = (id: string, chapter: number): Payoff => ({
  id, chapter, quote: "x".repeat(10), start: 0, end: 10, summary: id,
});

function result(over: Partial<AnalysisResult>): AnalysisResult {
  return {
    chapters: [], setups: [], payoffs: [], matches: [], unfired: [], tension: [],
    failedChapters: [], uncertain: [], droppedQuotes: 0, model: "m",
    promptVersions: { extract: "x", match: "m" }, ...over,
  };
}

describe("scoreRun", () => {
  it("finds 3 of 4 key setups plus 1 extra", () => {
    const r = result({
      setups: [
        setup("s1", 1, "The brass key hung round her neck on a green ribbon"),
        setup("s2", 1, "the clock was eleven minutes fast all her childhood, always"),
        setup("s3", 2, "He whistled three notes at dusk every single evening, rain or shine"),
        setup("s4", 3, "an unrelated sentence about a teapot on the shelf"),
      ],
      droppedQuotes: 1,
      payoffs: [payoff("p1", 3), payoff("p2", 4), payoff("p3", 4)],
      matches: [
        { setupId: "s1", payoffId: "p1", reasoning: "", source: "extract" },
        { setupId: "s2", payoffId: "p2", reasoning: "", source: "extract" },
        { setupId: "s3", payoffId: "p3", reasoning: "", source: "extract" },
      ],
    });
    const s = scoreRun(r, key);
    expect(s.recall).toBe(0.75);
    expect(s.wrongSetups).toBe(1);
    expect(s.wrongMatches).toBe(0);
    expect(s.unfiredTotal).toBe(1);
    expect(s.unfiredCorrect).toBe(0);
    expect(s.dropRate).toBeCloseTo(1 / (1 + 4 + 3));
  });

  it("counts a key unfired setup that is in unfired as correct", () => {
    const r = result({
      setups: [setup("s1", 1, "The flare gun was kept loaded for emergencies at sea, they said")],
      unfired: ["s1"],
    });
    const s = scoreRun(r, key);
    expect(s.unfiredCorrect).toBe(1);
    expect(s.unfiredTotal).toBe(1);
  });

  it("flags a match whose payoff chapter differs from the key", () => {
    const r = result({
      setups: [setup("s1", 1, "The brass key hung round her neck on a green ribbon")],
      payoffs: [payoff("p1", 4)],
      matches: [{ setupId: "s1", payoffId: "p1", reasoning: "", source: "match" }],
    });
    expect(scoreRun(r, key).wrongMatches).toBe(1);
  });

  it("requires equal chapters and handles an empty result", () => {
    const r = result({ setups: [setup("s1", 2, "The brass key hung round her neck on a green ribbon")] });
    const s = scoreRun(r, key);
    expect(s.recall).toBe(0);
    expect(s.wrongSetups).toBe(1);
    expect(s.dropRate).toBe(0);
  });

  it("accepts 6 shared consecutive words without containment", () => {
    const r = result({
      setups: [setup("s1", 1, "Oh, the clock was eleven minutes fast, as ever, and nobody cared")],
    });
    expect(scoreRun(r, key).recall).toBe(0.25);
  });
});

describe("answer keys match their stories", () => {
  const slugs = readdirSync("samples").filter((d) => existsSync(join("samples", d, "answer-key.json")));

  it("has at least one sample", () => expect(slugs.length).toBeGreaterThan(0));

  for (const slug of slugs) {
    it(`${slug}: every quoteHint is an exact 8+ word substring of its chapter`, () => {
      const story = readFileSync(join("public", "samples", slug, "story.md"), "utf8");
      const { chapters, autoSplit } = chapterize(story);
      expect(autoSplit).toBe(false);
      const k = JSON.parse(readFileSync(join("samples", slug, "answer-key.json"), "utf8")) as AnswerKey & {
        payoffsWithoutSetup?: { chapter: number; quoteHint: string }[];
      };
      const hints = [
        ...k.setups.map((s) => ({ chapter: s.chapter, hint: s.quoteHint })),
        ...(k.payoffsWithoutSetup ?? []).map((p) => ({ chapter: p.chapter, hint: p.quoteHint })),
      ];
      for (const { chapter, hint } of hints) {
        expect(hint.split(/\s+/).length).toBeGreaterThanOrEqual(8);
        expect(chapters.find((c) => c.index === chapter)?.text.includes(hint), hint).toBe(true);
      }
    });
  }

  it("the-locked-drawer has 4 chapters and 5 setups (1 unfired)", () => {
    const story = readFileSync("public/samples/the-locked-drawer/story.md", "utf8");
    expect(chapterize(story).chapters).toHaveLength(4);
    const k = JSON.parse(readFileSync("samples/the-locked-drawer/answer-key.json", "utf8")) as AnswerKey;
    expect(k.setups).toHaveLength(5);
    expect(k.setups.filter((s) => s.payoffChapter === null)).toHaveLength(1);
  });
});
