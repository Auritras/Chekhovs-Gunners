import type { AnalysisResult } from "@/lib/types";
import type { Overrides } from "@/lib/view/overrides";

export interface RhythmRow {
  chapter: number;
  /** Guns planted in this chapter (not counting ones the writer set aside). */
  planted: number;
  /** Shots that land in this chapter: the tool's links and the writer's calls. */
  fired: number;
}

/** Per chapter: how many guns are planted, and how many fire. */
export function rhythm(result: AnalysisResult, overrides: Overrides): RhythmRow[] {
  const rows = new Map(result.chapters.map((c) => [c.index, { chapter: c.index, planted: 0, fired: 0 }]));
  for (const s of result.setups) {
    if (overrides[s.id]?.kind === "dismissed") continue;
    const r = rows.get(s.chapter);
    if (r) r.planted++;
  }
  const payoffChapter = new Map(result.payoffs.map((p) => [p.id, p.chapter]));
  for (const m of result.matches) {
    const r = rows.get(payoffChapter.get(m.payoffId) ?? -1);
    if (r) r.fired++;
  }
  for (const o of Object.values(overrides)) {
    if (o.kind !== "fired") continue;
    const r = rows.get(o.chapter);
    if (r) r.fired++;
  }
  return [...rows.values()];
}

/** One plain line about the balance, or null when there is too little to say. */
export function rhythmNote(rows: RhythmRow[]): string | null {
  const n = rows.length;
  const planted = rows.reduce((t, r) => t + r.planted, 0);
  const fired = rows.reduce((t, r) => t + r.fired, 0);
  if (n < 3 || planted + fired < 4) return null;
  const lastFired = rows[n - 1].fired;
  const firstHalf = rows.slice(0, Math.ceil(n / 2)).reduce((t, r) => t + r.planted, 0);
  const lateThird = rows.slice(n - Math.max(1, Math.floor(n / 3))).reduce((t, r) => t + r.planted, 0);
  if (fired >= 3 && lastFired / fired >= 0.5) {
    return "Half or more of the payoffs land in the final chapter: the ending may feel rushed.";
  }
  if (planted >= 4 && lateThird / planted >= 0.35) {
    return "Many guns are planted in the last third, leaving little room to fire them.";
  }
  if (planted >= 4 && firstHalf / planted >= 0.8) {
    return "The story is front-loaded: nearly every gun is planted in the first half, and the second half fires them.";
  }
  return "Setups and payoffs are spread across the story.";
}
