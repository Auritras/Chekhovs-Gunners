import type { AnalysisResult, Setup } from "@/lib/types";
import type { Overrides } from "@/lib/view/overrides";

/**
 * The loose end the story leans on most: the most important gun that never fires, and of
 * equals, the one planted earliest (it has hung on the wall longest). Guns the writer has
 * ruled on are left out; uncertain ones only count when nothing surer is left.
 */
export function biggestLooseEnd(result: AnalysisResult, overrides: Overrides): Setup | null {
  const fired = new Set(result.matches.map((m) => m.setupId));
  const uncertain = new Set(result.uncertain);
  const loose = result.setups.filter((s) => result.unfired.includes(s.id) && !fired.has(s.id) && !overrides[s.id]);
  const rank = (a: Setup, b: Setup) =>
    Number(uncertain.has(a.id)) - Number(uncertain.has(b.id)) ||
    b.importance - a.importance ||
    a.chapter - b.chapter ||
    a.start - b.start;
  return [...loose].sort(rank)[0] ?? null;
}
