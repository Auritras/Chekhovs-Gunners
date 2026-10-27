import { describe, it, expect } from "vitest";
import { layoutArcs } from "@/lib/view/arcLayout";
import type { AnalysisResult } from "@/lib/types";

function base(): AnalysisResult {
  return {
    chapters: [
      { index: 1, title: "One", text: "a".repeat(100) },
      { index: 2, title: "Two", text: "b".repeat(100) },
    ],
    setups: [
      { id: "s1", chapter: 1, quote: "a", start: 0, end: 1, kind: "object", summary: "", importance: 1 },
      { id: "s2", chapter: 1, quote: "a", start: 50, end: 51, kind: "object", summary: "", importance: 1 },
    ],
    payoffs: [{ id: "p1", chapter: 2, quote: "b", start: 50, end: 51, summary: "" }],
    matches: [{ setupId: "s1", payoffId: "p1", reasoning: "", source: "match" }],
    unfired: ["s2"],
    tension: [],
    failedChapters: [],
    uncertain: ["s2"],
    droppedQuotes: 0,
    model: "m",
    promptVersions: { extract: "1", match: "1" },
  };
}

describe("layoutArcs", () => {
  it("places nodes in equal chapter bands and draws one arc", () => {
    const out = layoutArcs(base(), 1000);
    expect(out.chapterTicks).toEqual([
      { chapter: 1, x: 0, title: "One" },
      { chapter: 2, x: 500, title: "Two" },
    ]);
    expect(out.nodes.find((n) => n.id === "s1")!.x).toBe(0);
    expect(out.nodes.find((n) => n.id === "p1")!.x).toBe(750);
    expect(out.arcs).toHaveLength(1);
    expect(out.arcs[0]).toMatchObject({ setupId: "s1", payoffId: "p1", x1: 0, x2: 750 });
  });

  it("derives node state and uncertainty", () => {
    const nodes = layoutArcs(base(), 1000).nodes;
    expect(nodes.map((n) => n.id)).toEqual(["s1", "s2", "p1"]);
    expect(nodes[0]).toMatchObject({ kind: "setup", state: "fired", uncertain: false });
    expect(nodes[1]).toMatchObject({ state: "unfired", uncertain: true });
    expect(nodes[2]).toMatchObject({ kind: "payoff", state: "linked" });
  });

  it("marks unmatched payoffs unlinked", () => {
    const r = base();
    r.matches = [];
    expect(layoutArcs(r, 1000).nodes[2].state).toBe("unlinked");
  });

  it("makes longer arcs taller", () => {
    const r = base();
    r.matches.push({ setupId: "s2", payoffId: "p1", reasoning: "", source: "match" });
    const [long, short] = layoutArcs(r, 1000).arcs;
    expect(long.height).toBeGreaterThan(short.height);
  });

  it("handles empty chapter text without NaN", () => {
    const r = base();
    r.chapters[0].text = "";
    r.setups[0].start = 0;
    expect(layoutArcs(r, 1000).nodes[0].x).toBe(0);
  });
});
