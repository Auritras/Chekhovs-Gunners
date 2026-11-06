import { describe, expect, it } from "vitest";
import { joinPdfLines, linesFromItems, type PdfLine } from "@/lib/input/pdfText";

/** A line at baseline y; full width runs from x=72 to 520. */
const L = (text: string, y: number, right = 520, x = 72): PdfLine => ({ text, x, right, y });

describe("linesFromItems", () => {
  it("groups items on one baseline into a line, adding a space at a visible gap", () => {
    const item = (str: string, x: number, y: number, width: number) => ({ str, transform: [1, 0, 0, 1, x, y], width, height: 12 });
    const lines = linesFromItems([item("Hello", 72, 700, 30), item("world", 106, 700, 30), item("Next", 72, 683, 25)]);
    expect(lines.map((l) => l.text)).toEqual(["Hello world", "Next"]);
  });
});

describe("joinPdfLines", () => {
  it("joins wrapped lines and breaks after a short line", () => {
    const text = joinPdfLines([[L("The storm came", 700), L("three days early.", 683, 200), L("Osei called everyone", 666), L("into the galley.", 649, 180)]]);
    expect(text).toBe("The storm came three days early.\n\nOsei called everyone into the galley.");
  });

  it("breaks at a larger gap and at an indented first line", () => {
    const spaced = joinPdfLines([[L("One full line", 700), L("ends here.", 683), L("Two", 658), L("and on", 641)]]);
    expect(spaced).toBe("One full line ends here.\n\nTwo and on");
    const indented = joinPdfLines([[L("One full line", 700), L("ends here.", 683), L("Two", 666, 520, 90), L("and on", 649)]]);
    expect(indented).toBe("One full line ends here.\n\nTwo and on");
  });

  it("keeps a hyphenated word whole across lines", () => {
    expect(joinPdfLines([[L("a hand-", 700), L("painted sign", 683)]])).toBe("a hand-painted sign");
  });

  it("carries a sentence across a page break, but not a finished one", () => {
    const carried = joinPdfLines([[L("She walked past it", 700), L("twice a day and", 683)], [L("every time she wanted it.", 700)]]);
    expect(carried).toBe("She walked past it twice a day and every time she wanted it.");
    const split = joinPdfLines([[L("Seal it now,", 700), L("better them than us.\"", 683)], [L("But Petra was inside.", 700)]]);
    expect(split).toBe("Seal it now, better them than us.\"\n\nBut Petra was inside.");
  });

  it("finds paragraph gaps on a page of one-line dialogue", () => {
    const text = joinPdfLines([[L("\"Now,\" he said.", 700), L("\"Yes,\" she said.", 675), L("\"Go,\" he said.", 650), L("It was a long", 625), L("night.", 608, 150)]]);
    expect(text.split("\n\n")).toHaveLength(4);
  });
});
