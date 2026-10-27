import type { AnalysisResult } from "@/lib/types";

export interface SummaryCounts {
  planted: number;
  fired: number;
  neverFired: number;
  /** Unfired setups whose payoff may sit in a failed chapter. Uncertain payoffs are not counted. */
  uncertain: number;
}

/** Summary tile counts. Always planted = fired + neverFired + uncertain. */
export function summaryCounts(result: AnalysisResult): SummaryCounts {
  const firedIds = new Set(result.matches.map((m) => m.setupId));
  const uncertainIds = new Set(result.uncertain);
  let fired = 0;
  let neverFired = 0;
  let uncertain = 0;
  for (const s of result.setups) {
    if (firedIds.has(s.id)) fired++;
    else if (uncertainIds.has(s.id)) uncertain++;
    else neverFired++;
  }
  return { planted: result.setups.length, fired, neverFired, uncertain };
}
