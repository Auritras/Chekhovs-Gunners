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

  it("auto-splits one huge line at sentence ends", () => {
    const sentence = `${words(20)}.`;
    const r = chapterize(Array(200).fill(sentence).join(" "));
    expect(r.wordCount).toBe(4000);
    expect(r.autoSplit).toBe(true);
    expect(r.chapters.length).toBeGreaterThanOrEqual(3);
    for (const c of r.chapters) {
      const n = c.text.split(/\s+/).length;
      expect(n).toBeGreaterThan(1000);
      expect(n).toBeLessThan(2000);
      expect(c.text.endsWith(".")).toBe(true);
      expect(c.text.split(" ").length % 20).toBe(0);
    }
  });
});
