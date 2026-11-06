import { describe, expect, it } from "vitest";
import { compareDrafts, isNewDraft } from "@/lib/view/compare";
import type { AnalysisResult, Setup } from "@/lib/types";

const gun = (id: string, quote: string, summary: string): Setup => ({
  id, chapter: 1, quote, start: 0, end: quote.length, kind: "object", summary, importance: 2,
});

function result(text: string, setups: Setup[], fired: string[]): AnalysisResult {
  return {
    chapters: [{ index: 1, title: "One", text }],
    setups,
    payoffs: fired.map((id) => ({ id: `p-${id}`, chapter: 1, quote: "x", start: 0, end: 1, summary: "x" })),
    matches: fired.map((id) => ({ setupId: id, payoffId: `p-${id}`, reasoning: "", source: "match" as const })),
    unfired: setups.map((s) => s.id).filter((id) => !fired.includes(id)),
    tension: [0], failedChapters: [], uncertain: [], droppedQuotes: 0, model: "m",
    promptVersions: { extract: "x", match: "m" },
  };
}

const story = "The red valve hung on the pump room wall beside the airlock that always stuck in the cold";

describe("isNewDraft", () => {
  it("is a draft when most of the vocabulary is shared, not when identical or unrelated", () => {
    const a = result(story, [], []);
    expect(isNewDraft(a, result(story + " and the moss grew", [], []))).toBe(true);
    expect(isNewDraft(a, result(story, [], []))).toBe(false);
    expect(isNewDraft(a, result("A detective climbed the stairs of the clock tower at midnight", [], []))).toBe(false);
  });
});

describe("compareDrafts", () => {
  const prev = result(story, [
    gun("a1", "a red valve with a sign beneath it", "The red valve"),
    gun("a2", "Airlock Three stuck in the cold", "The sticking airlock"),
    gun("a3", "her grandmother's seed packet", "The seed packet"),
    gun("a4", "the dust siren chirped once", "The broken siren"),
  ], ["a4"]);

  it("pairs guns across runs by their words and sorts the changes", () => {
    const next = result(story + " moss", [
      // Fresh ids, slightly different wording: still the same guns.
      gun("b1", "a red valve with a hand-painted sign beneath it", "The red valve"),
      gun("b2", "Airlock Three stuck whenever it was cold", "The sticking airlock"),
      gun("b4", "the dust siren chirped once", "The broken siren"),
      gun("b5", "a coil of rope in the corner", "The rope"),
    ], ["b2"]);
    const c = compareDrafts(prev, next, 5);
    expect(c.nowFires.map((s) => s.id)).toEqual(["b2"]);
    // The siren fired before and doesn't now; the rope is new.
    expect(c.newLoose.map((s) => s.id).sort()).toEqual(["b4", "b5"]);
    // The seed packet was loose and is gone from this draft.
    expect(c.gone.map((s) => s.id)).toEqual(["a3"]);
    expect(c.stillLoose).toBe(1);
    expect(c.since).toBe(5);
  });

  it("pairs each old gun at most once", () => {
    const next = result(story, [
      gun("b1", "a red valve with a sign beneath it", "The red valve"),
      gun("b9", "a red valve with a sign beneath it", "The red valve"),
    ], []);
    const c = compareDrafts(prev, next, 0);
    expect(c.stillLoose).toBe(1);
    expect(c.newLoose.map((s) => s.id)).toEqual(["b9"]);
  });

  it("pairs a gun reworded by a fresh run, and never calls a line still in the story gone", () => {
    const text = "Dadu taught her to hear the syrup. Years later she heard the syrup turn and took it off the flame.";
    const before = result(text, [
      gun("a1", "she heard the syrup turn", "Mitali can tell when syrup is cooked by listening to its sound"),
      gun("a2", "Years later", "Something happened years later"),
    ], []);
    const after = result(text + " The end.", [
      gun("b1", "Dadu taught her to hear the syrup", "Dadu taught Mitali to judge syrup by listening to its sound"),
    ], ["b1"]);
    const c = compareDrafts(before, after, 0);
    expect(c.nowFires.map((s) => s.id)).toEqual(["b1"]);
    // a2 was not found this run, but its line is still there: not gone.
    expect(c.gone).toEqual([]);
  });

  it("pairs guns quoted from the same line even when worded differently", () => {
    const text = "On the wall hung a red valve. Nobody knew what it did.";
    const before = result(text, [{ ...gun("a1", "a red valve", "Valve"), start: 18, end: 29 }], []);
    const after = result(text + " Later.", [{ ...gun("b1", "On the wall hung a red valve", "Mystery fixture"), start: 0, end: 29 }], ["b1"]);
    expect(compareDrafts(before, after, 0).nowFires.map((s) => s.id)).toEqual(["b1"]);
  });
});

