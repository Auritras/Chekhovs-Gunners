import type { Chapter, Match, Payoff, Setup } from "@/lib/types";

/** The last 15% of a story is its ending: something introduced there has no room left to pay off. */
const ENDING_FRACTION = 0.85;

/** Keep only candidates that are coherent: known ids, payoff after setup, payoff not already linked. */
export function resolveMatches(
  setups: Setup[],
  payoffs: Payoff[],
  candidates: Match[],
): Match[] {
  const setupById = new Map(setups.map((s) => [s.id, s]));
  const payoffById = new Map(payoffs.map((p) => [p.id, p]));
  const linked = new Set<string>();
  const result: Match[] = [];
  for (const c of candidates) {
    const s = setupById.get(c.setupId);
    const p = payoffById.get(c.payoffId);
    if (!s || !p) continue;
    const after =
      p.chapter > s.chapter || (p.chapter === s.chapter && p.start > s.start);
    if (!after || linked.has(p.id)) continue;
    linked.add(p.id);
    result.push({ ...c });
  }
  return result;
}

export function matchesFromExtraction(payoffs: Payoff[]): Match[] {
  return payoffs
    .filter((p) => p.firesSetupId)
    .map((p) => ({
      setupId: p.firesSetupId as string,
      payoffId: p.id,
      reasoning: "",
      source: "extract" as const,
    }));
}

export function findUnfired(setups: Setup[], matches: Match[]): string[] {
  const fired = new Set(matches.map((m) => m.setupId));
  return setups.filter((s) => !fired.has(s.id)).map((s) => s.id);
}

/** Unfired setups whose position in the whole story falls in its ending (see ENDING_FRACTION). */
export function findInEnding(chapters: Chapter[], setups: Setup[], matches: Match[]): string[] {
  const offset = new Map<number, number>();
  let total = 0;
  for (const c of chapters) {
    offset.set(c.index, total);
    total += c.text.length;
  }
  if (total === 0) return [];
  const endingStarts = total * ENDING_FRACTION;
  const unfired = new Set(findUnfired(setups, matches));
  return setups
    .filter((s) => unfired.has(s.id) && (offset.get(s.chapter) ?? 0) + s.start >= endingStarts)
    .map((s) => s.id);
}

export function findUnlinkedPayoffs(payoffs: Payoff[], matches: Match[]): string[] {
  const linked = new Set(matches.map((m) => m.payoffId));
  return payoffs.filter((p) => !linked.has(p.id)).map((p) => p.id);
}

/** Unfired setups / unlinked payoffs whose answer might lie in a chapter that failed. */
export function markUncertain(
  setups: Setup[],
  payoffs: Payoff[],
  matches: Match[],
  failedChapters: number[],
): string[] {
  if (failedChapters.length === 0) return [];
  const unfired = new Set(findUnfired(setups, matches));
  const unlinked = new Set(findUnlinkedPayoffs(payoffs, matches));
  const uncertainSetups = setups
    .filter((s) => unfired.has(s.id) && failedChapters.some((f) => f > s.chapter))
    .map((s) => s.id);
  const uncertainPayoffs = payoffs
    .filter((p) => unlinked.has(p.id) && failedChapters.some((f) => f < p.chapter))
    .map((p) => p.id);
  return [...uncertainSetups, ...uncertainPayoffs];
}
