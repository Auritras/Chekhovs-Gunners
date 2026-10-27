import { describe, it, expect } from "vitest";
import { chapterize } from "@/lib/chapterize";

const words = (n: number, w = "word") => Array(n).fill(w).join(" ");

describe("chapterize", () => {
  it("splits on Chapter headings", () => {
    const r = chapterize("Chapter 1\nA.\n\nChapter 2\nB.");
    expect(r.chapters).toHaveLength(2);
    expect(r.chapters.map((c) => c.title)).toEqual(["Chapter 1", "Chapter 2"]);
    expect(r.chapters.map((c) => c.text)).toEqual(["A.", "B."]);
    expect(r.chapters.map((c) => c.index)).toEqual([1, 2]);
    expect(r.autoSplit).toBe(false);
  });

  it("splits on markdown headings", () => {
    const r = chapterize("# One\nAlpha text.\n\n## Two\nBeta text.");
    expect(r.chapters).toHaveLength(2);
    expect(r.chapters[0].title).toBe("One");
    expect(r.chapters[1].text).toBe("Beta text.");
  });

  it("splits on *** separators into 3 sections", () => {
    const r = chapterize("First.\n\n***\n\nSecond.\n\n* * *\n\nThird.");
    expect(r.chapters).toHaveLength(3);
    expect(r.chapters.map((c) => c.title)).toEqual(["Part 1", "Part 2", "Part 3"]);
    expect(r.chapters.map((c) => c.text)).toEqual(["First.", "Second.", "Third."]);
    expect(r.autoSplit).toBe(false);
  });

  it("makes a >=50-word preface an Opening chapter", () => {
    const r = chapterize(`${words(60)}\n\nChapter 1\nBody.`);
    expect(r.chapters).toHaveLength(2);
    expect(r.chapters[0].title).toBe("Opening");
    expect(r.chapters[1].title).toBe("Chapter 1");
  });

  it("prepends a short preface to the first chapter", () => {
    const r = chapterize(`${words(10)}\n\nChapter 1\nBody.`);
    expect(r.chapters).toHaveLength(1);
    expect(r.chapters[0].text).toContain(words(10));
    expect(r.chapters[0].text).toContain("Body.");
  });

  it("auto-splits headingless text at paragraph breaks", () => {
    const para = words(100);
    const text = Array(40).fill(para).join("\n\n");
    const r = chapterize(text);
    expect(r.autoSplit).toBe(true);
    expect(r.wordCount).toBe(4000);
    expect(r.chapters).toHaveLength(3);
    expect(r.chapters.map((c) => c.title)).toEqual(["Part 1", "Part 2", "Part 3"]);
    for (const c of r.chapters) {
      expect(c.text.split(/\n\s*\n/).every((p) => p === para)).toBe(true);
    }
  });

  it("recognises CHAPTER TWELVE: The Drawer", () => {
    const r = chapterize("CHAPTER TWELVE: The Drawer\nText.");
    expect(r.chapters).toHaveLength(1);
    expect(r.chapters[0].title).toBe("CHAPTER TWELVE: The Drawer");
    expect(r.chapters[0].text).toBe("Text.");
    expect(r.autoSplit).toBe(false);
  });

  it("recognises bare roman numerals and drops empty chapters", () => {
    const r = chapterize("I\nOne.\n\nII\n\nIII\nThree.");
    expect(r.chapters.map((c) => c.title)).toEqual(["I", "III"]);
    expect(r.chapters.map((c) => c.index)).toEqual([1, 2]);
  });

  it("auto-splits single-newline paragraphs at line breaks", () => {
    const line = words(100);
    const r = chapterize(Array(40).fill(line).join("\n"));
    expect(r.autoSplit).toBe(true);
    expect(r.chapters).toHaveLength(3);
    for (const c of r.chapters) {
      expect(c.text.split("\n").every((l) => l === line)).toBe(true);
    }
  });

  it("keeps *** separators as ordinary text when real headings exist", () => {
    const r = chapterize("Chapter 1\nFirst.\n\n***\n\nStill one.\n\nChapter 2\nSecond.\n\n* * *\n\nStill two.");
    expect(r.chapters.map((c) => c.title)).toEqual(["Chapter 1", "Chapter 2"]);
    expect(r.chapters[0].text).toBe("First.\n\n***\n\nStill one.");
    expect(r.chapters[1].text).toBe("Second.\n\n* * *\n\nStill two.");
  });

  it("keeps separators as text alongside markdown and roman headings too", () => {
    expect(chapterize("# One\nA.\n***\nB.").chapters.map((c) => c.title)).toEqual(["One"]);
    expect(chapterize("I\nA.\n* * *\nB.\nII\nC.").chapters.map((c) => c.title)).toEqual(["I", "II"]);
  });

  it("sub-splits a headed chapter over 8,000 words into titled parts", () => {
    const para = words(100);
    const long = Array(170).fill(para).join("\n\n"); // 17,000 words
    const r = chapterize(`Chapter 1\nShort opening chapter.\n\nChapter 2\n${long}\n\nChapter 3\nThe end.`);
    expect(r.autoSplit).toBe(false);
    expect(r.chapters.map((c) => c.title)).toEqual([
      "Chapter 1",
      "Chapter 2 (part 1)",
      "Chapter 2 (part 2)",
      "Chapter 2 (part 3)",
      "Chapter 3",
    ]);
    expect(r.chapters.map((c) => c.index)).toEqual([1, 2, 3, 4, 5]);
    const parts = r.chapters.slice(1, 4);
    for (const c of parts) {
      expect(c.text.split(/\s+/).length).toBeLessThanOrEqual(8000);
      expect(c.text.split(/\n\s*\n/).every((p) => p === para)).toBe(true);
    }
    expect(parts.reduce((sum, c) => sum + c.text.split(/\s+/).length, 0)).toBe(17000);
  });

  it("leaves a headed chapter of exactly 8,000 words whole", () => {
    const r = chapterize(`Chapter 1\n${Array(80).fill(words(100)).join("\n\n")}`);
    expect(r.chapters.map((c) => c.title)).toEqual(["Chapter 1"]);
  });

  it("auto-splits one huge line at sentence ends", () => {
    const sentence = `${words(20)}.`;
    const r = chapterize(Array(200).fill(sentence).join(" "));
    expect(r.wordCount).toBe(4000);
    expect(r.autoSplit).toBe(true);
    expect(r.chapters.length).toBeGreaterThanOrEqual(3);
    for (const c of r.chapters) {
      const n = c.text.split(/\s+/).length;
      expect(n).toBeGreaterThanOrEqual(1000);
      expect(n).toBeLessThan(2000);
      expect(c.text.endsWith(".")).toBe(true);
      expect(c.text.split(" ").length % 20).toBe(0);
    }
  });
});
