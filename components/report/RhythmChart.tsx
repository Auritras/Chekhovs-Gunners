import type { AnalysisResult } from "@/lib/types";
import type { Overrides } from "@/lib/view/overrides";
import { rhythm, rhythmNote } from "@/lib/view/rhythm";

/**
 * Rhythm: per chapter, guns planted (left, ink) against shots fired (right, brass), so a
 * front-loaded first half or a rushed ending shows at a glance.
 */
export default function RhythmChart({ result, overrides }: { result: AnalysisResult; overrides: Overrides }) {
  const rows = rhythm(result, overrides);
  const max = Math.max(1, ...rows.flatMap((r) => [r.planted, r.fired]));
  const note = rhythmNote(rows);
  const title = (n: number) => result.chapters.find((c) => c.index === n)?.title || `Chapter ${n}`;

  return (
    <section aria-labelledby="rhythm-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="rhythm-heading" className="font-display text-3xl">
          Rhythm
        </h2>
        <p className="mt-1 max-w-[62ch] text-sm text-ink-soft">
          Guns planted against guns fired, chapter by chapter.
        </p>
        {note && <p className="mt-2 max-w-[62ch] font-serif italic text-ink">{note}</p>}
      </div>
      <div className="flex gap-5 text-sm text-ink-soft" aria-hidden>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-4 bg-ink-soft" /> Planted
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-4 bg-brass" /> Fired
        </span>
      </div>
      <ol className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <li
            key={r.chapter}
            className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-x-2 gap-y-1 sm:grid-cols-[minmax(0,15rem)_2rem_minmax(0,1fr)_minmax(0,1fr)_2rem]"
          >
            <span className="col-span-4 truncate text-sm sm:col-span-1" title={title(r.chapter)}>
              {title(r.chapter)}
            </span>
            <span className="text-right font-display text-lg tabular-nums leading-none text-ink-soft">
              <span className="sr-only">Planted </span>
              {r.planted}
            </span>
            {/* Planted grows left from the centre line, fired grows right. */}
            <span className="flex h-3 justify-end border-r border-ink" aria-hidden>
              <span className="block h-full bg-ink-soft" style={{ width: `${(r.planted / max) * 100}%` }} />
            </span>
            <span className="flex h-3" aria-hidden>
              <span className="block h-full bg-brass" style={{ width: `${(r.fired / max) * 100}%` }} />
            </span>
            <span className="font-display text-lg tabular-nums leading-none text-brass">
              <span className="sr-only">Fired </span>
              {r.fired}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
