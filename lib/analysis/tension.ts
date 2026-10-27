import type { Match, Payoff, Setup } from "@/lib/types";

/** Per chapter 1..chapterCount: total importance of setups introduced but not yet fired. */
export function computeTension(
  chapterCount: number,
  setups: Setup[],
  payoffs: Payoff[],
  matches: Match[],
): number[] {
  const payoffChapter = new Map(payoffs.map((p) => [p.id, p.chapter]));
  const firstFire = new Map<string, number>();
  for (const m of matches) {
    const ch = payoffChapter.get(m.payoffId);
    if (ch === undefined) continue;
    const prev = firstFire.get(m.setupId);
    if (prev === undefined || ch < prev) firstFire.set(m.setupId, ch);
  }
  const result: number[] = [];
  for (let n = 1; n <= chapterCount; n++) {
    let sum = 0;
    for (const s of setups) {
      if (s.chapter > n) continue;
      const fired = firstFire.get(s.id);
      if (fired !== undefined && fired <= n) continue;
      sum += s.importance;
    }
    result.push(sum);
  }
  return result;
}
