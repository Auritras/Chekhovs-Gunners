import type { LedgerEntry, Setup } from "@/lib/types";

const MAX_SUMMARY = 160;

function truncate(s: string): string {
  return s.length > MAX_SUMMARY ? s.slice(0, MAX_SUMMARY - 1) + "…" : s;
}

/** Compact, ordered view of setups sent to the model as context. */
export function toLedger(setups: Setup[]): LedgerEntry[] {
  return [...setups]
    .sort((a, b) => a.chapter - b.chapter || a.start - b.start)
    .map((s) => ({ id: s.id, chapter: s.chapter, kind: s.kind, summary: truncate(s.summary) }));
}
