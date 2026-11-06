"use client";

import type { RecentReport } from "@/lib/view/recent";

/** The writer's last few reports, to reopen without spending any AI quota. */
export default function RecentReports({
  reports,
  onOpen,
  onForget,
}: {
  reports: RecentReport[];
  onOpen: (r: RecentReport) => void;
  onForget: (key: string) => void;
}) {
  if (reports.length === 0) return null;
  const date = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
      <h2 id="recent-heading" className="text-xs uppercase tracking-[0.16em] text-muted">
        Your recent reports
      </h2>
      <ul className="flex flex-col">
        {reports.map((r) => (
          <li key={r.key} className="flex items-center gap-2 border-t border-line last:border-b">
            <button
              type="button"
              onClick={() => onOpen(r)}
              className="flex min-h-11 min-w-0 flex-1 flex-wrap items-baseline gap-x-3 py-2 text-left transition-colors hover:text-brass"
            >
              <span className="truncate font-display text-lg">{r.title}</span>
              <span className="text-xs text-muted">
                {date(r.at)} · {r.words.toLocaleString("en-US")} words
              </span>
            </button>
            <button
              type="button"
              onClick={() => onForget(r.key)}
              aria-label={`Forget ${r.title}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-muted transition-colors hover:text-curtain"
            >
              <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4">
                <path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
