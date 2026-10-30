import type { AnalysisResult, Payoff, Setup } from "@/lib/types";

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

  // One row per gun: a setup can pay off more than once (e.g. a skill used twice).
  const bySetup = new Map<string, { setup: Setup; payoffs: Payoff[] }>();
  for (const m of result.matches) {
    const setup = setups.get(m.setupId);
    const payoff = payoffs.get(m.payoffId);
    if (!setup || !payoff) continue;
    const row = bySetup.get(setup.id) ?? { setup, payoffs: [] };
    row.payoffs.push(payoff);
    bySetup.set(setup.id, row);
  }
  const guns = [...bySetup.values()]
    .map((g) => ({ ...g, payoffs: g.payoffs.sort((a, b) => a.chapter - b.chapter || a.start - b.start) }))
    .sort((a, b) => a.setup.chapter - b.setup.chapter || a.setup.start - b.setup.start);
  if (guns.length === 0) return null;

  const chapterTitle = (n: number) =>
    result.chapters.find((c) => c.index === n)?.title || `Chapter ${n}`;

  return (
    <details id="fired" className="group scroll-mt-24 border-y border-line">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 py-3 font-display text-2xl marker:hidden [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-brass transition-transform group-open:rotate-90">
          ›
        </span>
        Guns that fired <span className="text-brass tabular-nums">({guns.length})</span>
      </summary>
      <ul className="flex flex-col pb-2">
        {guns.map(({ setup, payoffs }) => (
          <li key={setup.id} className="border-t border-line">
            <button
              type="button"
              onClick={() => onSelect(setup.id)}
              className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-4 py-4 text-left transition-colors hover:bg-surface sm:px-3"
            >
              <span aria-hidden className="mt-1.5 block h-3 w-3 rounded-full bg-ink" />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-base font-medium leading-snug">{setup.summary}</span>
                <span className="text-sm text-ink-soft">Planted in {chapterTitle(setup.chapter)}</span>
                {/* Spans, not a list: a button may only hold phrasing content. */}
                {payoffs.map((p) => (
                  <span key={p.id} className="block text-sm text-ink-soft">
                    Fires in {chapterTitle(p.chapter)}: <span className="text-ink">{p.summary}</span>
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
