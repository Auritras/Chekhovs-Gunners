import type { AnalysisResult } from "@/lib/types";

/** The guns that did fire, collapsed: lets the writer check what the tool understood. */
export default function FiredList({
  result,
  onSelect,
}: {
  result: AnalysisResult;
  onSelect: (setupId: string) => void;
}) {
  const setups = new Map(result.setups.map((s) => [s.id, s]));
  const payoffs = new Map(result.payoffs.map((p) => [p.id, p]));
  const pairs = result.matches
    .map((m) => ({ setup: setups.get(m.setupId), payoff: payoffs.get(m.payoffId) }))
    .filter((p): p is { setup: NonNullable<typeof p.setup>; payoff: NonNullable<typeof p.payoff> } =>
      Boolean(p.setup && p.payoff),
    )
    .sort((a, b) => a.setup.chapter - b.setup.chapter || a.setup.start - b.setup.start);
  if (pairs.length === 0) return null;

  const chapterTitle = (n: number) =>
    result.chapters.find((c) => c.index === n)?.title || `Chapter ${n}`;

  return (
    <details id="fired" className="group scroll-mt-24 border-y border-line">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 py-3 font-display text-2xl marker:hidden [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-brass transition-transform group-open:rotate-90">
          ›
        </span>
        Guns that fired <span className="text-brass tabular-nums">({pairs.length})</span>
      </summary>
      <ul className="flex flex-col pb-2">
        {pairs.map(({ setup, payoff }) => (
          <li key={`${setup.id}-${payoff.id}`} className="border-t border-line">
            <button
              type="button"
              onClick={() => onSelect(setup.id)}
              className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-4 py-4 text-left transition-colors hover:bg-surface sm:px-3"
            >
              <span aria-hidden className="mt-1.5 block h-3 w-3 rounded-full bg-ink" />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-base font-medium leading-snug">{setup.summary}</span>
                <span className="text-sm text-ink-soft">
                  Planted in {chapterTitle(setup.chapter)}, fires in {chapterTitle(payoff.chapter)}:{" "}
                  <span className="text-ink">{payoff.summary}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
