"use client";

import type { AnalysisResult } from "@/lib/types";
import { biggestLooseEnd } from "@/lib/view/biggestLooseEnd";
import type { Overrides } from "@/lib/view/overrides";

const IMPORTANCE = { 1: "Minor", 2: "Notable", 3: "Major" } as const;

/** The headline of the report: the loose end the story leans on most. */
export default function BiggestLooseEnd({
  result,
  overrides,
  onSelect,
}: {
  result: AnalysisResult;
  overrides: Overrides;
  onSelect: (setupId: string) => void;
}) {
  const gun = biggestLooseEnd(result, overrides);
  if (!gun) return null;
  const title = result.chapters.find((c) => c.index === gun.chapter)?.title || `Chapter ${gun.chapter}`;
  const quote = gun.quote.replace(/\s+/g, " ").trim();
  return (
    <section aria-labelledby="biggest-heading" className="border-l-2 border-curtain pl-4 sm:pl-5">
      <h2 id="biggest-heading" className="text-xs uppercase tracking-[0.18em] text-curtain">
        Biggest loose end
      </h2>
      <p className="mt-1 font-display text-2xl leading-snug text-ink sm:text-[1.7rem]">{gun.summary}</p>
      <p className="mt-1 max-w-[70ch] font-serif italic text-ink-soft">“{quote}”</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-muted">
        <span>
          Planted in {title} · {IMPORTANCE[gun.importance]} · never fires
        </span>
        <button
          type="button"
          onClick={() => onSelect(gun.id)}
          className="min-h-11 text-brass underline decoration-line underline-offset-4 transition-colors hover:text-ink"
        >
          See it in the story →
        </button>
      </p>
    </section>
  );
}
