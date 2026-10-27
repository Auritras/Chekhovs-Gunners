import { z } from "zod";
import type { Chapter as ChapterType, LedgerEntry as LedgerEntryType } from "@/lib/types";

export const MAX_CHAPTER_CHARS = 60_000;
export const MAX_LEDGER_ENTRIES = 400;
export const MAX_MATCH_SETUPS = 400;
export const MAX_MATCH_PAYOFFS = 400;

export const SetupKind = z.enum([
  "object",
  "trait",
  "secret",
  "promise",
  "skill",
  "relationship",
  "other",
]);

export const Chapter = z.object({
  index: z.number().int().min(1),
  title: z.string(),
  text: z.string().max(MAX_CHAPTER_CHARS),
}) satisfies z.ZodType<ChapterType>;

export const LedgerEntry = z.object({
  id: z.string(),
  chapter: z.number().int().min(1),
  kind: SetupKind,
  summary: z.string(),
}) satisfies z.ZodType<LedgerEntryType>;

/** What the model returns for one chapter. Offsets are added by code, not the model. */
export const RawExtraction = z.object({
  setups: z.array(
    z.object({
      quote: z.string(),
      kind: SetupKind,
      summary: z.string(),
      importance: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    }),
  ),
  payoffs: z.array(
    z.object({
      quote: z.string(),
      summary: z.string(),
      firesSetupId: z.string().nullable(),
    }),
  ),
});
export type RawExtraction = z.infer<typeof RawExtraction>;

export const RawMatches = z.object({
  matches: z.array(
    z.object({
      setupId: z.string(),
      payoffId: z.string(),
      reasoning: z.string(),
    }),
  ),
});
export type RawMatches = z.infer<typeof RawMatches>;

export const ExtractRequest = z.object({
  chapter: Chapter,
  ledger: z.array(LedgerEntry).max(MAX_LEDGER_ENTRIES),
});
export type ExtractRequest = z.infer<typeof ExtractRequest>;

export const MatchRequest = z.object({
  setups: z.array(LedgerEntry).max(MAX_MATCH_SETUPS),
  payoffs: z
    .array(
      z.object({
        id: z.string(),
        chapter: z.number().int().min(1),
        summary: z.string(),
        quote: z.string(),
      }),
    )
    .max(MAX_MATCH_PAYOFFS),
});
export type MatchRequest = z.infer<typeof MatchRequest>;
