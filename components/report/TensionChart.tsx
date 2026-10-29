import TensionLandscape from "@/components/report/TensionLandscape";
import type { AnalysisResult } from "@/lib/types";

/** Horizontal bars so long chapter titles stay readable at phone width. */
export default function TensionChart({ result }: { result: AnalysisResult }) {
  const max = Math.max(1, ...result.tension);
  const failed = new Set(result.failedChapters);
  const peak = Math.max(...result.tension);

  return (
    <section aria-labelledby="tension-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="tension-heading" className="font-display text-3xl">
          Tension by chapter
        </h2>
        <p className="mt-1 max-w-[62ch] text-sm text-ink-soft">
          How much is still loaded at the end of each chapter: setups planted but not yet fired,
          weighted by importance.
        </p>
      </div>
      <TensionLandscape tension={result.tension} />
      <ol className="flex flex-col gap-2.5">
        {result.chapters.map((c, i) => {
          const value = result.tension[i] ?? 0;
          const isPeak = value > 0 && value === peak;
          return (
            <li
              key={c.index}
              className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_2.5rem]"
            >
              <span className="col-span-2 truncate text-sm sm:col-span-1" title={c.title}>
                {c.title || `Chapter ${c.index}`}
                {failed.has(c.index) && <span className="text-muted"> (not analysed)</span>}
              </span>
              <span className="h-3 bg-paper-deep" aria-hidden>
                <span
                  className={`block h-full ${isPeak ? "bg-curtain" : "bg-ink-soft"}`}
                  style={{ width: `${(value / max) * 100}%` }}
                />
              </span>
              <span className="text-right font-display text-lg tabular-nums leading-none">
                <span className="sr-only">Tension </span>
                {value}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
