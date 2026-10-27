import type { AnalysisResult, Setup } from "@/lib/types";

const IMPORTANCE = { 1: "Minor", 2: "Notable", 3: "Major" } as const;

export default function IssueList({
  result,
  onSelect,
}: {
  result: AnalysisResult;
  onSelect: (setupId: string) => void;
}) {
  const uncertain = new Set(result.uncertain);
  const unfired = new Set(result.unfired);
  const issues: Setup[] = result.setups
    .filter((s) => unfired.has(s.id))
    .sort(
      (a, b) =>
        Number(uncertain.has(a.id)) - Number(uncertain.has(b.id)) ||
        b.importance - a.importance ||
        a.chapter - b.chapter ||
        a.start - b.start,
    );
  const chapterTitle = (n: number) =>
    result.chapters.find((c) => c.index === n)?.title || `Chapter ${n}`;

  return (
    <section aria-labelledby="issues-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="issues-heading" className="font-display text-3xl">
          Guns that never fire
        </h2>
        <p className="mt-1 max-w-[62ch] text-sm text-ink-soft">
          {issues.length > 0
            ? "Select one to see it in the story."
            : "Every setup we found pays off later in the story."}
        </p>
      </div>
      {issues.length > 0 && (
        <ul className="flex flex-col">
          {issues.map((s) => {
            const unsure = uncertain.has(s.id);
            return (
              <li key={s.id} className="border-t border-line last:border-b">
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className={`group grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-4 py-5 text-left transition-colors hover:bg-surface sm:px-3 ${
                    unsure ? "text-ink-soft" : ""
                  }`}
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 block h-3 w-3 rounded-full ${
                      unsure ? "border-[1.5px] border-dashed border-muted" : "bg-curtain"
                    }`}
                  />
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-soft">
                      <span>{chapterTitle(s.chapter)}</span>
                      <span className="capitalize">{s.kind}</span>
                      <span>{IMPORTANCE[s.importance]} importance</span>
                      {unsure && (
                        <span className="text-muted italic">may be affected by a failed chapter</span>
                      )}
                    </span>
                    <span className="text-base font-medium leading-snug">{s.summary}</span>
                    <span className="border-l-2 border-line pl-3 font-serif italic leading-relaxed text-ink-soft group-hover:border-curtain">
                      “{s.quote}”
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
