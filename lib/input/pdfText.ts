/**
 * PDFs store text as positioned lines, not paragraphs: every printed line ends in a break,
 * often mid-sentence. These helpers rebuild the paragraphs from the lines' geometry.
 */

/** One text item as pdf.js gives it (transform[4] is x, transform[5] the baseline y). */
export interface PdfItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

export interface PdfLine {
  text: string;
  /** Left edge, right edge and baseline, in PDF units (y grows upward). */
  x: number;
  right: number;
  y: number;
}

/** Group a page's items into lines by their baseline, in reading order. */
export function linesFromItems(items: PdfItem[]): PdfLine[] {
  const lines: PdfLine[] = [];
  for (const it of items) {
    if (!it.str) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    const cur = lines.at(-1);
    if (cur && Math.abs(cur.y - y) <= Math.max(2, it.height * 0.5)) {
      // Same line: add a space when there is a visible gap and none in the text.
      const gap = x - cur.right;
      const needsSpace = gap > Math.max(1, it.height * 0.15) && !/\s$/.test(cur.text) && !/^\s/.test(it.str);
      cur.text += (needsSpace ? " " : "") + it.str;
      cur.right = Math.max(cur.right, x + it.width);
    } else {
      lines.push({ text: it.str, x, right: x + it.width, y });
    }
  }
  return lines
    .map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() }))
    .filter((l) => l.text.length > 0);
}

/** The ordinary line spacing: the lower quartile of the gaps, since a page of short
 * one-line paragraphs (dialogue) can have more paragraph gaps than line gaps. */
const lineSpacing = (gaps: number[]) => {
  const s = [...gaps].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 4)] : 0;
};

/**
 * Join the lines of every page into paragraphs separated by blank lines. A paragraph ends
 * where a line stops well short of the text block's right edge, where the gap to the next
 * line is larger than usual, or where the next line is indented.
 */
export function joinPdfLines(pages: PdfLine[][]): string {
  const paragraphs: string[] = [];
  let para = "";
  const add = (text: string) => {
    if (!para) para = text;
    // A word broken across lines with a hyphen stays hyphenated, without a space.
    else if (/\p{L}-$/u.test(para)) para += text;
    else para += ` ${text}`;
  };
  const end = () => {
    if (para) paragraphs.push(para);
    para = "";
  };

  const filled = pages.filter((lines) => lines.length > 0);
  filled.forEach((lines, p) => {
    const left = Math.min(...lines.map((l) => l.x));
    const right = Math.max(...lines.map((l) => l.right));
    const width = right - left;
    const gaps = lines.slice(1).map((l, i) => lines[i].y - l.y).filter((g) => g > 0);
    const lineGap = lineSpacing(gaps);
    lines.forEach((line, i) => {
      add(line.text);
      const next = lines[i + 1];
      const short = line.right < right - width * 0.12;
      if (!next) {
        // Across a page break a full-width last line usually carries on into the next page,
        // unless it ends a sentence and the next page starts a new one.
        const first = filled[p + 1]?.[0]?.text ?? "";
        const sentenceEnds = /[.!?]["'”’)]?$/.test(line.text) && /^["'“‘(]?\p{Lu}/u.test(first);
        if (short || sentenceEnds) end();
        return;
      }
      const gap = line.y - next.y;
      const spaced = lineGap > 0 && gap > lineGap * 1.35;
      const indented = next.x > left + width * 0.02;
      if (short || spaced || indented || gap < 0) end();
    });
  });
  end();
  return paragraphs.join("\n\n");
}
