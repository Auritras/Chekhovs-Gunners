import type { AnalysisResult, Payoff, Setup, SetupKind } from "@/lib/types";
import type { Override, Overrides } from "@/lib/view/overrides";

type Gun = { setup: Setup; payoffs: Payoff[]; writerChapter?: number; writerQuote?: string };

/** The guns that did fire, collapsed: lets the writer check what the tool understood. */
export default function FiredList({
  result,
  overrides,
  onDecide,
  onSelect,
  onPointOut,
  kind = null,
  chapter = null,
}: {
  result: AnalysisResult;
  overrides: Overrides;
  onDecide: (setupId: string, call: Override | null) => void;
  onSelect: (setupId: string) => void;
  /** Open the story to let the writer select the passage where it fires. */
  onPointOut?: (setupId: string) => void;
  kind?: SetupKind | null;
  /** Only guns planted or firing in this chapter. */
  chapter?: number | null;
}) {
  const setups = new Map(result.setups.map((s) => [s.id, s]));
  const payoffs = new Map(result.payoffs.map((p) => [p.id, p]));

  // One row per gun: a setup can pay off more than once (e.g. a skill used twice).
  const bySetup = new Map<string, Gun>();
  for (const m of result.matches) {
    const setup = setups.get(m.setupId);
    const payoff = payoffs.get(m.payoffId);
    if (!setup || !payoff) continue;
    const row = bySetup.get(setup.id) ?? { setup, payoffs: [] };
    row.payoffs.push(payoff);
    bySetup.set(setup.id, row);
  }
  // Guns the tool said never fire, which the writer says do.
  for (const [id, call] of Object.entries(overrides)) {
    const setup = setups.get(id);
    if (call.kind === "fired" && setup) {
      bySetup.set(id, { setup, payoffs: [], writerChapter: call.chapter, writerQuote: call.quote });
    }
  }
  const guns = [...bySetup.values()]
    .filter((g) => !kind || g.setup.kind === kind)
    .filter(
      (g) =>
        chapter === null ||
        g.setup.chapter === chapter ||
        g.writerChapter === chapter ||
        g.payoffs.some((p) => p.chapter === chapter),
    )
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
        {guns.map(({ setup, payoffs, writerChapter, writerQuote }) => (
          <li key={setup.id} id={`card-${setup.id}`} className="flex scroll-mt-28 items-start gap-2 border-t border-line">
            <button
              type="button"
              onClick={() => onSelect(setup.id)}
              className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] gap-x-4 py-4 text-left transition-colors hover:bg-surface sm:px-3"
            >
              <span
                aria-hidden
                className={`mt-1.5 block h-3 w-3 rounded-full ${writerChapter ? "bg-gold" : "bg-ink"}`}
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-base font-medium leading-snug">{setup.summary}</span>
                <span className="text-sm text-ink-soft">Planted in {chapterTitle(setup.chapter)}</span>
                {/* Spans, not a list: a button may only hold phrasing content. */}
                {payoffs.map((p) => (
                  <span key={p.id} className="block text-sm text-ink-soft">
                    Fires in {chapterTitle(p.chapter)}: <span className="text-ink">{p.summary}</span>
                  </span>
                ))}
                {writerChapter !== undefined && (
                  <span className="block text-sm text-ink-soft">
                    Fires in {chapterTitle(writerChapter)}:{" "}
                    {writerQuote && <span className="font-serif italic text-ink">“{writerQuote}” </span>}
                    <span className="text-gold">marked by you</span>
                    <span className="block text-xs text-muted">The tool said: never fires</span>
                  </span>
                )}
              </span>
            </button>
            {writerChapter !== undefined && (
              <span className="mt-3 flex shrink-0 flex-col gap-2 sm:flex-row">
                {onPointOut && (
                  <button
                    type="button"
                    onClick={() => onPointOut(setup.id)}
                    className="min-h-11 rounded-sm border border-gold px-3 text-sm font-medium text-ink transition-colors hover:bg-gold hover:text-paper"
                  >
                    {writerQuote ? "Change line" : "Point to the line"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDecide(setup.id, null)}
                  className="min-h-11 rounded-sm border border-line px-3 text-sm font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
                >
                  Undo
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
