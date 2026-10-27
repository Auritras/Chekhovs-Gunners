import type { LedgerEntry, Setup } from "@/lib/types";
import type { MatchSetup } from "@/lib/ai/schemas";

const MAX_SUMMARY = 160;

function truncate(s: string): string {
  return s.length > MAX_SUMMARY ? s.slice(0, MAX_SUMMARY - 1) + "…" : s;
}

/** Compact, ordered view of setups sent to the model as context. */
export function toLedger(setups: Setup[]): LedgerEntry[] {
  return sortSetups(setups).map(ledgerEntry);
}

/** Setups for the match pass: ledger entries plus each setup's quote (to judge same-chapter order). */
export function toMatchSetups(setups: Setup[]): MatchSetup[] {
  return sortSetups(setups).map((s) => ({ ...ledgerEntry(s), quote: s.quote }));
}

function sortSetups(setups: Setup[]): Setup[] {
  return [...setups].sort((a, b) => a.chapter - b.chapter || a.start - b.start);
}

function ledgerEntry(s: Setup): LedgerEntry {
  return { id: s.id, chapter: s.chapter, kind: s.kind, summary: truncate(s.summary) };
}
