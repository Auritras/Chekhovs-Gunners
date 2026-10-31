import { describe, expect, it } from "vitest";
import { callAchievements, storyAchievements } from "@/lib/view/achievements";
import type { AnalysisResult, Payoff, Setup } from "@/lib/types";

const setup = (id: string, chapter: number, quote = "q", kind: Setup["kind"] = "object"): Setup => ({
  id, chapter, quote, start: 0, end: 1, kind, summary: "", importance: 2,
});
const payoff = (id: string, chapter: number): Payoff => ({ id, chapter, quote: "q", start: 0, end: 1, summary: "" });
const match = (setupId: string, payoffId: string) => ({ setupId, payoffId, reasoning: "", source: "match" as const });

function result(over: Partial<AnalysisResult>): AnalysisResult {
  return {
    chapters: [1, 2, 3].map((index) => ({ index, title: `C${index}`, text: "x" })),
    setups: [], payoffs: [], matches: [], unfired: [], tension: [], failedChapters: [], uncertain: [],
    droppedQuotes: 0, model: "m", promptVersions: { extract: "x", match: "m" }, ...over,
  };
}

describe("storyAchievements", () => {
  it("finds the story's achievements from its links", () => {
    const r = result({
      setups: [setup("s1", 1, "an old revolver"), setup("s2", 2, "q", "promise")],
      payoffs: [payoff("p1", 3), payoff("p2", 2), payoff("p3", 3)],
      matches: [match("s1", "p1"), match("s2", "p2"), match("s2", "p3")],
    });
    expect(storyAchievements(r, {}).sort()).toEqual(
      ["chekhov-approves", "double-tap", "long-fuse", "promise-kept", "same-scene", "the-original", "tight-ship"].sort(),
    );
  });

  it("counts the writer's calls and withholds approval while a gun never fires", () => {
    const r = result({ setups: [setup("s1", 1, "a pistol"), setup("s2", 1)], unfired: ["s1", "s2"] });
    expect(storyAchievements(r, {})).not.toContain("chekhov-approves");
    const after = storyAchievements(r, { s1: { kind: "fired", chapter: 3 }, s2: { kind: "dismissed" } });
    expect(after).toEqual(expect.arrayContaining(["chekhov-approves", "the-original", "long-fuse"]));
  });
});

describe("callAchievements", () => {
  it("rewards overruling, setting aside, pointing and the Stopped Clock's herrings", () => {
    const r = result({
      setups: [setup("s1", 1, "owed money to half the bookmakers in Siliguri"), setup("writer-gun-1", 2)],
      unfired: ["s1", "writer-gun-1"],
    });
    expect(
      callAchievements(r, { s1: { kind: "dismissed" }, "writer-gun-1": { kind: "fired", chapter: 3, start: 0 } }).sort(),
    ).toEqual(["case-closed", "pinpoint", "red-herring", "script-doctor", "sharp-eye"]);
  });
});
