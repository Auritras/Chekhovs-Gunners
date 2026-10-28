import { describe, it, expect } from "vitest";
import {
  resolveMatches,
  matchesFromExtraction,
  findUnfired,
  findUnlinkedPayoffs,
  markUncertain,
  findInEnding,
} from "@/lib/analysis/resolve";
import type { Setup, Payoff, Match } from "@/lib/types";

const setup = (id: string, chapter: number, start = 10): Setup => ({
  id, chapter, quote: "q", start, end: start + 1, kind: "object", summary: "s", importance: 2,
});
const payoff = (id: string, chapter: number, start = 10, firesSetupId?: string): Payoff => ({
  id, chapter, quote: "q", start, end: start + 1, summary: "p", firesSetupId,
});
const cand = (setupId: string, payoffId: string): Match => ({
  setupId, payoffId, reasoning: "r", source: "match",
});

describe("resolveMatches", () => {
  it("drops unknown ids", () => {
    const s = [setup("s1", 1)];
    const p = [payoff("p1", 2)];
    expect(resolveMatches(s, p, [cand("nope", "p1"), cand("s1", "nope")])).toEqual([]);
  });
  it("drops payoff in an earlier chapter", () => {
    expect(resolveMatches([setup("s1", 4)], [payoff("p1", 2)], [cand("s1", "p1")])).toEqual([]);
  });
  it("same chapter: payoff before setup dropped, after kept", () => {
    const s = [setup("s1", 2, 50)];
    expect(resolveMatches(s, [payoff("p1", 2, 10)], [cand("s1", "p1")])).toEqual([]);
    expect(resolveMatches(s, [payoff("p1", 2, 50)], [cand("s1", "p1")])).toEqual([]);
    const ok = resolveMatches(s, [payoff("p1", 2, 80)], [cand("s1", "p1")]);
    expect(ok).toHaveLength(1);
  });
  it("keeps only the first match for a payoff", () => {
    const s = [setup("s1", 1), setup("s2", 1)];
    const r = resolveMatches(s, [payoff("p1", 2)], [cand("s2", "p1"), cand("s1", "p1")]);
    expect(r.map((m) => m.setupId)).toEqual(["s2"]);
  });
  it("an invalid first candidate does not block a later valid one", () => {
    const s = [setup("s1", 3), setup("s2", 1)];
    const r = resolveMatches(s, [payoff("p1", 2)], [cand("s1", "p1"), cand("s2", "p1")]);
    expect(r.map((m) => m.setupId)).toEqual(["s2"]);
  });
  it("keeps several payoffs for one setup, in candidate order, without mutating", () => {
    const s = [setup("s1", 1)];
    const p = [payoff("p1", 2), payoff("p2", 3)];
    const c = [cand("s1", "p2"), cand("s1", "p1")];
    const copy = JSON.parse(JSON.stringify(c));
    expect(resolveMatches(s, p, c).map((m) => m.payoffId)).toEqual(["p2", "p1"]);
    expect(c).toEqual(copy);
  });
});

describe("matchesFromExtraction", () => {
  it("creates extract matches for payoffs with firesSetupId", () => {
    const r = matchesFromExtraction([payoff("p1", 2, 1, "s1"), payoff("p2", 2)]);
    expect(r).toEqual([{ setupId: "s1", payoffId: "p1", reasoning: "", source: "extract" }]);
  });
});

describe("findUnfired / findUnlinkedPayoffs", () => {
  const matches = [cand("s1", "p1")];
  it("returns setups without a match", () => {
    expect(findUnfired([setup("s1", 1), setup("s2", 1)], matches)).toEqual(["s2"]);
  });
  it("returns payoffs without a match, ignoring firesSetupId", () => {
    expect(findUnlinkedPayoffs([payoff("p1", 2), payoff("p2", 2, 1, "s1")], matches)).toEqual(["p2"]);
  });
});

describe("markUncertain", () => {
  const setups = [setup("s2", 2), setup("s4", 4)];
  const payoffs = [payoff("p5", 5), payoff("p2", 2)];
  it("flags unfired setups before and unlinked payoffs after a failed chapter", () => {
    expect(markUncertain(setups, payoffs, [], [3])).toEqual(["s2", "p5"]);
  });
  it("returns [] with no failed chapters", () => {
    expect(markUncertain(setups, payoffs, [], [])).toEqual([]);
  });
  it("ignores linked items", () => {
    expect(markUncertain(setups, payoffs, [cand("s2", "p5")], [3])).toEqual([]);
  });
});

describe("findInEnding", () => {
  const ch = (index: number, len = 100) => ({ index, title: `C${index}`, text: "x".repeat(len) });
  const fired = (s: string): Match => cand(s, "p1");

  it("flags unfired setups in the last 15% of the whole story, not earlier ones or fired ones", () => {
    const chapters = [ch(1), ch(2)]; // 200 chars in all; the ending starts at 170
    const s = [setup("late", 2, 90), setup("mid", 2, 10), setup("firedLate", 2, 95), setup("edge", 2, 69)];
    expect(findInEnding(chapters, s, [fired("firedLate")])).toEqual(["late"]);
  });

  it("keeps early setups of a one-chapter story as real unfired guns", () => {
    expect(findInEnding([ch(1)], [setup("early", 1, 5), setup("last", 1, 95)], [])).toEqual(["last"]);
  });

  it("returns nothing for an empty story", () => {
    expect(findInEnding([], [], [])).toEqual([]);
  });
});
