import { describe, it, expect } from "vitest";
import { normalise, verifyQuotes } from "@/lib/analysis/verifyQuotes";

describe("normalise", () => {
  it("normalises punctuation, whitespace and case", () => {
    expect(normalise("  “Don’t”  open\nit — ever… ")).toBe(`"don't" open it-ever...`);
  });
});

describe("verifyQuotes", () => {
  const text = "The cellar door was old. She said nothing about the key on the hook.";

  it("keeps an exact quote with correct start", () => {
    const q = "the key on the hook";
    const { kept, dropped } = verifyQuotes([{ quote: q }], text);
    expect(dropped).toBe(0);
    expect(kept[0].start).toBe(text.indexOf(q));
  });

  it("keeps messy variants and points start at the D", () => {
    const chapter = "He warned her. “Don’t open\nit—ever.” Then he left.";
    const d = chapter.indexOf("D");
    for (const quote of [
      `"Don't open it - ever."`,
      `"Don't open it-ever."`,
      `"don't open it--ever"`,
      `Don't open it - ever.`,
    ]) {
      const { kept, dropped } = verifyQuotes([{ quote }], chapter);
      expect(dropped, quote).toBe(0);
      expect(kept[0].start, quote).toBe(d);
    }
  });

  it("drops invented quotes", () => {
    const { kept, dropped } = verifyQuotes([{ quote: "a dragon ate the moon" }], text);
    expect(kept).toHaveLength(0);
    expect(dropped).toBe(1);
  });

  it("drops too-short quotes", () => {
    const { kept, dropped } = verifyQuotes([{ quote: "Yes." }], "He said, Yes. Then left.");
    expect(kept).toHaveLength(0);
    expect(dropped).toBe(1);
  });

  it("uses the first occurrence", () => {
    const t = "the red door. the red door again.";
    expect(verifyQuotes([{ quote: "the red door" }], t).kept[0].start).toBe(0);
  });
});
