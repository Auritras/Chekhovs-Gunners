import { describe, expect, it } from "vitest";
import { notesHtml, notesMarkdown } from "@/lib/view/notes";
import type { AnalysisResult } from "@/lib/types";

const r: AnalysisResult = {
  chapters: [
    { index: 1, title: "One", text: "A gun hung by the door. A bell rang." },
    { index: 2, title: "Two", text: "She fired the gun." },
  ],
  setups: [
    { id: "s1", chapter: 1, quote: "A gun hung by the door.", start: 0, end: 23, kind: "object", summary: "The gun", importance: 3 },
    { id: "s2", chapter: 1, quote: "A bell rang.", start: 24, end: 36, kind: "object", summary: "The bell", importance: 1 },
    { id: "writer-gun-a", chapter: 1, quote: "the door", start: 14, end: 22, kind: "other", summary: "The door", importance: 2 },
  ],
  payoffs: [{ id: "p1", chapter: 2, quote: "She fired the gun.", start: 0, end: 18, summary: "She fires it" }],
  matches: [{ setupId: "s1", payoffId: "p1", reasoning: "", source: "extract" }],
  unfired: ["s2", "writer-gun-a"],
  tension: [1, 0], failedChapters: [], uncertain: [], droppedQuotes: 0, model: "m",
  promptVersions: { extract: "x", match: "m" },
};

describe("notesMarkdown", () => {
  it("lists loose ends with quotes, the writer's decisions and the guns that fired", () => {
    const md = notesMarkdown(r, { "writer-gun-a": { kind: "fired", chapter: 2, start: 0, end: 18, quote: "She fired the gun." } }, new Date("2026-11-01"));
    expect(md).toContain("## Loose ends: guns that never fire");
    expect(md).toContain("**The bell** (One, object)\n  > A bell rang.");
    expect(md).toContain("### Marked as firing");
    expect(md).toContain("fires in Two\n  > She fired the gun.");
    expect(md).toContain("### Guns you added");
    expect(md).toContain("## Guns that fired");
    expect(md).toContain("  - fires in Two: She fires it");
    expect(md).toContain("2026-11-01");
  });

  it("renders to print HTML with headings, items and quotes, escaping text", () => {
    const html = notesHtml("# T\n- **A <b>** (x)\n  > q & r");
    expect(html).toContain("<h1>T</h1>");
    expect(html).toContain('<p class="item"><strong>A &lt;b&gt;</strong> (x)</p>');
    expect(html).toContain("<blockquote>q &amp; r</blockquote>");
  });
});
