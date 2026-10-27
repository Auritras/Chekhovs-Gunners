const MIN_QUOTE_LENGTH = 8;

type Mapped = { text: string; map: number[] };

/** Normalise while keeping, for each output char, its index in the original. */
function normaliseWithMap(s: string): Mapped {
  let chars: { c: string; i: number }[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\u2018" || ch === "\u2019") chars.push({ c: "'", i });
    else if (ch === "\u201C" || ch === "\u201D") chars.push({ c: '"', i });
    else if (ch === "\u2014" || ch === "\u2013") chars.push({ c: "-", i });
    else if (ch === "\u2026") for (let k = 0; k < 3; k++) chars.push({ c: ".", i });
    else if (/\s/.test(ch)) chars.push({ c: " ", i });
    else chars.push({ c: ch, i });
  }

  // Collapse runs of dashes ("--") to one.
  chars = chars.filter((x, k) => !(x.c === "-" && k > 0 && chars[k - 1].c === "-"));
  // Collapse whitespace runs.
  chars = chars.filter((x, k) => !(x.c === " " && k > 0 && chars[k - 1].c === " "));
  // Remove spaces adjacent to a dash.
  chars = chars.filter(
    (x, k) =>
      !(x.c === " " && (chars[k - 1]?.c === "-" || chars[k + 1]?.c === "-")),
  );
  // Trim.
  while (chars.length && chars[0].c === " ") chars.shift();
  while (chars.length && chars[chars.length - 1].c === " ") chars.pop();

  let text = "";
  const map: number[] = [];
  for (const { c, i } of chars) {
    const lower = c.toLowerCase();
    for (let k = 0; k < lower.length; k++) {
      text += lower[k];
      map.push(i);
    }
  }
  return { text, map };
}

export function normalise(s: string): string {
  return normaliseWithMap(s).text;
}

export function verifyQuotes<T extends { quote: string }>(
  items: T[],
  chapterText: string,
): { kept: (T & { start: number })[]; dropped: number } {
  const chapter = normaliseWithMap(chapterText);
  const kept: (T & { start: number })[] = [];
  let dropped = 0;

  for (const item of items) {
    const needle = normalise(item.quote);
    let idx = -1;
    if (needle.length >= MIN_QUOTE_LENGTH) {
      // Prefer the quote without its own wrapping quote marks, so start
      // points at the first real character; fall back to the full text.
      const stripped = needle.replace(/^["']+|["']+$/g, "").trim();
      if (stripped.length >= MIN_QUOTE_LENGTH) {
        idx = chapter.text.indexOf(stripped);
      }
      if (idx === -1) idx = chapter.text.indexOf(needle);
    }
    if (idx === -1) dropped++;
    else kept.push({ ...item, start: chapter.map[idx] });
  }
  return { kept, dropped };
}
