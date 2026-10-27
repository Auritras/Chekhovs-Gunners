import type { AnalysisResult } from "@/lib/types";
import { normalise } from "@/lib/analysis/verifyQuotes";

export interface AnswerKey {
  setups: { id: string; chapter: number; quoteHint: string; payoffChapter: number | null }[];
}

export interface RunScore {
  recall: number;
  wrongSetups: number;
  wrongMatches: number;
  unfiredCorrect: number;
  unfiredTotal: number;
  dropRate: number;
}

const SHARED_WORDS = 6;

function words(s: string): string[] {
  return s.split(/[^\p{L}\p{N}']+/u).filter(Boolean);
}

/** One contains the other, or they share SHARED_WORDS consecutive words (both normalised). */
function overlaps(a: string, b: string): boolean {
  const na = normalise(a);
  const nb = normalise(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wa = words(na);
  const wb = words(nb);
  if (wa.length < SHARED_WORDS || wb.length < SHARED_WORDS) return false;
  const grams = new Set<string>();
  for (let i = 0; i + SHARED_WORDS <= wa.length; i++) {
    grams.add(wa.slice(i, i + SHARED_WORDS).join(" "));
  }
  for (let i = 0; i + SHARED_WORDS <= wb.length; i++) {
    if (grams.has(wb.slice(i, i + SHARED_WORDS).join(" "))) return true;
  }
  return false;
}

export function scoreRun(result: AnalysisResult, key: AnswerKey): RunScore {
  const hits = (s: AnalysisResult["setups"][number], k: AnswerKey["setups"][number]) =>
    s.chapter === k.chapter && overlaps(s.quote, k.quoteHint);

  const keyHitBy = new Map<string, Set<string>>(); // key id -> found setup ids
  for (const k of key.setups) {
    keyHitBy.set(k.id, new Set(result.setups.filter((s) => hits(s, k)).map((s) => s.id)));
  }

  const found = key.setups.filter((k) => keyHitBy.get(k.id)!.size > 0).length;
  const recall = key.setups.length ? found / key.setups.length : 0;

  const wrongSetups = result.setups.filter(
    (s) => !key.setups.some((k) => hits(s, k)),
  ).length;

  const payoffChapter = new Map(result.payoffs.map((p) => [p.id, p.chapter]));
  let wrongMatches = 0;
  for (const m of result.matches) {
    const setup = result.setups.find((s) => s.id === m.setupId);
    if (!setup) continue;
    const k = key.setups.find((kk) => hits(setup, kk));
    if (!k) continue; // already counted as a wrong setup
    if (payoffChapter.get(m.payoffId) !== k.payoffChapter) wrongMatches++;
  }

  const unfiredKeys = key.setups.filter((k) => k.payoffChapter === null);
  const unfired = new Set(result.unfired);
  const unfiredCorrect = unfiredKeys.filter((k) =>
    [...keyHitBy.get(k.id)!].some((id) => unfired.has(id)),
  ).length;

  const denom = result.droppedQuotes + result.setups.length + result.payoffs.length;
  const dropRate = denom ? result.droppedQuotes / denom : 0;

  return { recall, wrongSetups, wrongMatches, unfiredCorrect, unfiredTotal: unfiredKeys.length, dropRate };
}
