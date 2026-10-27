export interface HighlightMark {
  id: string;
  start: number;
  end: number;
  kind: "setup" | "payoff";
  state: string;
}

/** Splits text at every mark boundary; marks use [start, end). */
export function highlightSegments(
  text: string,
  marks: HighlightMark[],
): { text: string; marks: string[] }[] {
  const len = text.length;
  const valid = marks
    .map((m) => ({ id: m.id, start: Math.max(0, m.start), end: Math.min(len, m.end) }))
    .filter((m) => m.end > m.start);

  const cuts = new Set<number>([0, len]);
  for (const m of valid) {
    cuts.add(m.start);
    cuts.add(m.end);
  }
  const points = [...cuts].sort((a, b) => a - b);

  const segments: { text: string; marks: string[] }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    segments.push({
      text: text.slice(a, b),
      marks: valid.filter((m) => m.start <= a && m.end >= b).map((m) => m.id),
    });
  }
  return segments;
}
