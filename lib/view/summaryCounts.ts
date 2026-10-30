import type { AnalysisResult } from "@/lib/types";
import type { Overrides } from "@/lib/view/overrides";

export interface SummaryCounts {
  planted: number;
  /** Includes the guns the writer marked as firing (`firedByWriter`). */
  fired: number;
  neverFired: number;
  /** Unfired setups whose payoff may sit in a failed chapter. Uncertain payoffs are not counted. */
  uncertain: number;
  /** Unfired setups in the story's ending, too late to pay off. */
  inEnding: number;
  /** Of `fired`, how many the writer marked as firing although the tool said they never do. */
  firedByWriter: number;
  /** Guns the writer set aside as not really guns. */
  setAside: number;
}

/**
 * Summary tile counts, after the writer's calls (if any).
 * Always planted = fired + neverFired + uncertain + inEnding + setAside.
 */
export function summaryCounts(result: AnalysisResult, overrides: Overrides = {}): SummaryCounts {
  const firedIds = new Set(result.matches.map((m) => m.setupId));
  const uncertainIds = new Set(result.uncertain);
  const endingIds = new Set(result.inEnding ?? []);
  let fired = 0;
  let neverFired = 0;
  let uncertain = 0;
  let inEnding = 0;
  let firedByWriter = 0;
  let setAside = 0;
  for (const s of result.setups) {
    const call = firedIds.has(s.id) ? undefined : overrides[s.id];
    if (firedIds.has(s.id)) fired++;
    else if (call?.kind === "fired") {
      fired++;
      firedByWriter++;
    } else if (call?.kind === "dismissed") setAside++;
    else if (uncertainIds.has(s.id)) uncertain++;
    else if (endingIds.has(s.id)) inEnding++;
    else neverFired++;
  }
  return { planted: result.setups.length, fired, neverFired, uncertain, inEnding, firedByWriter, setAside };
}
