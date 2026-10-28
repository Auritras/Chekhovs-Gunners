import type { AnalysisResult } from "@/lib/types";

export interface SummaryCounts {
  planted: number;
  fired: number;
  neverFired: number;
  /** Unfired setups whose payoff may sit in a failed chapter. Uncertain payoffs are not counted. */
  uncertain: number;
  /** Unfired setups in the story's ending, too late to pay off. */
  inEnding: number;
}

/** Summary tile counts. Always planted = fired + neverFired + uncertain + inEnding. */
export function summaryCounts(result: AnalysisResult): SummaryCounts {
  const firedIds = new Set(result.matches.map((m) => m.setupId));
  const uncertainIds = new Set(result.uncertain);
  const endingIds = new Set(result.inEnding ?? []);
  let fired = 0;
  let neverFired = 0;
  let uncertain = 0;
  let inEnding = 0;
  for (const s of result.setups) {
    if (firedIds.has(s.id)) fired++;
    else if (uncertainIds.has(s.id)) uncertain++;
    else if (endingIds.has(s.id)) inEnding++;
    else neverFired++;
  }
  return { planted: result.setups.length, fired, neverFired, uncertain, inEnding };
}
