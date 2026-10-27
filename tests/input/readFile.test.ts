// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { Document, Packer, Paragraph } from "docx";
import { readFile } from "@/lib/input/readFile";

describe("readFile", () => {
  it("reads .txt", async () => {
    const f = new File(["Once upon a time, there was a gun."], "a.txt");
    expect(await readFile(f)).toEqual({ text: "Once upon a time, there was a gun." });
  });
  it("reads .md", async () => {
    const f = new File(["# Title\n\nSome long enough story text here."], "a.md");
    expect(await readFile(f)).toEqual({ text: "# Title\n\nSome long enough story text here." });
  });
  it("rejects unsupported types", async () => {
    expect(await readFile(new File(["hello world"], "a.rtf"))).toEqual({ error: "unsupported" });
  });
  it("returns no_text for whitespace-only", async () => {
    expect(await readFile(new File(["   \n\n  "], "a.txt"))).toEqual({ error: "no_text" });
  });
  it("reads .docx", async () => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph("Chapter 1"),
            new Paragraph("The old rifle hung above the mantel, waiting."),
          ],
        },
      ],
    });
    const buf = await Packer.toBuffer(doc);
    const f = new File([new Uint8Array(buf)], "story.docx");
    const r = await readFile(f);
    expect("text" in r && r.text).toContain("Chapter 1");
    expect("text" in r && r.text).toContain("old rifle");
  });
});
