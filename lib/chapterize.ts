import type { Chapter } from "@/lib/types";

const NUMBER_WORDS =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred";
const CHAPTER_RE = new RegExp(
  String.raw`^\s*chapter\s+(\d+|` + NUMBER_WORDS + String.raw`|[ivxlcdm]+)(?!\w)(\s*[:.\-–—]?\s*.*)?$`,
  "i",
);
const MARKDOWN_RE = /^\s{0,3}#{1,2}\s+(.+?)\s*#*\s*$/;
const SEPARATOR_RE = /^\s*(\*\*\*|\* \* \*)\s*$/;
const ROMAN_RE = /^\s*(XL|X{0,3}(IX|IV|V?I{0,3}))\.?\s*$/;

const AUTO_SPLIT_WORDS = 1500;
const OPENING_MIN_WORDS = 50;

const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

type Heading = { kind: "title" | "separator"; title: string } | null;

function classify(line: string): Heading {
  if (SEPARATOR_RE.test(line)) return { kind: "separator", title: "" };
  const md = MARKDOWN_RE.exec(line);
  if (md) return { kind: "title", title: md[1].trim() };
  if (CHAPTER_RE.test(line)) return { kind: "title", title: line.trim() };
  const t = line.trim();
  if (t !== "" && ROMAN_RE.test(line)) return { kind: "title", title: t };
  return null;
}

function finalize(raw: { title: string; text: string }[]): Chapter[] {
  return raw
    .map((c) => ({ title: c.title, text: c.text.trim() }))
    .filter((c) => c.text.length > 0)
    .map((c, i) => ({ index: i + 1, title: c.title, text: c.text }));
}

type Unit = { text: string; sep: string };

// Split into units no larger than the target where possible: blank-line
// paragraphs first, then single lines, then sentences.
function splitUnits(text: string, level = 0): Unit[] {
  const splitters: [RegExp, string][] = [
    [/\n\s*\n/, "\n\n"],
    [/\n/, "\n"],
    [/(?<=[.!?])\s+/, " "],
  ];
  if (level >= splitters.length) return [{ text, sep: "" }];
  const [re, sep] = splitters[level];
  const pieces = text.split(re).map((p) => p.trim()).filter(Boolean);
  const out: Unit[] = [];
  for (const piece of pieces) {
    if (countWords(piece) > AUTO_SPLIT_WORDS && level + 1 < splitters.length) {
      out.push(...splitUnits(piece, level + 1));
    } else {
      out.push({ text: piece, sep: "" });
    }
    out[out.length - 1].sep = sep;
  }
  return out;
}

function autoSplit(text: string): Chapter[] {
  const units = splitUnits(text);
  const parts: Unit[][] = [];
  let cur: Unit[] = [];
  let curWords = 0;
  for (const u of units) {
    const w = countWords(u.text);
    if (cur.length > 0 && curWords + w > AUTO_SPLIT_WORDS) {
      const over = curWords + w - AUTO_SPLIT_WORDS;
      const under = AUTO_SPLIT_WORDS - curWords;
      if (over > under) {
        parts.push(cur);
        cur = [];
        curWords = 0;
      }
    }
    cur.push(u);
    curWords += w;
    if (curWords >= AUTO_SPLIT_WORDS) {
      parts.push(cur);
      cur = [];
      curWords = 0;
    }
  }
  if (cur.length > 0) parts.push(cur);
  const join = (us: Unit[]) =>
    us.map((u, i) => (i < us.length - 1 ? u.text + u.sep : u.text)).join("");
  return finalize(parts.map((us, i) => ({ title: `Part ${i + 1}`, text: join(us) })));
}

export function chapterize(text: string): {
  chapters: Chapter[];
  autoSplit: boolean;
  wordCount: number;
} {
  const wordCount = countWords(text);
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  const sections: { title: string | null; separator: boolean; lines: string[] }[] = [
    { title: null, separator: false, lines: [] },
  ];
  let found = false;
  for (const line of lines) {
    const h = classify(line);
    if (h) {
      found = true;
      sections.push({ title: h.title, separator: h.kind === "separator", lines: [] });
    } else {
      sections[sections.length - 1].lines.push(line);
    }
  }

  if (!found) {
    return { chapters: autoSplit(text), autoSplit: true, wordCount };
  }

  const [preface, ...rest] = sections;
  const prefaceText = preface.lines.join("\n").trim();
  const out: { title: string; text: string }[] = [];

  // Separator sections are titled by their position among separator sections.
  let partNo = 0;
  if (rest[0]?.separator) {
    // Text before a leading *** is a real section, not a preface.
    if (prefaceText) {
      partNo++;
      out.push({ title: `Part ${partNo}`, text: prefaceText });
    }
  } else if (prefaceText) {
    if (countWords(prefaceText) >= OPENING_MIN_WORDS) {
      out.push({ title: "Opening", text: prefaceText });
    } else {
      rest[0].lines.unshift(prefaceText, "");
    }
  }

  for (const s of rest) {
    let title = s.title ?? "";
    if (s.separator) {
      partNo++;
      title = `Part ${partNo}`;
    }
    out.push({ title, text: s.lines.join("\n") });
  }

  return { chapters: finalize(out), autoSplit: false, wordCount };
}
