"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import { highlightSegments, type HighlightMark } from "@/lib/view/highlight";

export const markElementId = (id: string) => `mark-${id}`;

type Info = { kind: "setup" | "payoff"; state: string; uncertain: boolean; summary: string };

/** Which style wins where marks overlap: problems first. */
function rank(i: Info): number {
  if (i.kind === "setup" && i.state === "unfired" && !i.uncertain) return 0;
  if (i.uncertain) return 1;
  if (i.kind === "setup") return 2;
  return 3;
}

function markClass(i: Info): string {
  if (i.uncertain) return "mark mark-uncertain";
  return `mark mark-${i.kind}-${i.state}`;
}

export default function StoryView({
  result,
  target,
}: {
  result: AnalysisResult;
  target: { id: string; seq: number } | null;
}) {
  // The jump (by seq) the writer dismissed; while a newer one is live, other highlights fade.
  const [dismissed, setDismissed] = useState<number | null>(null);
  const focusId = target && target.seq !== dismissed ? target.id : null;

  const { info, marksByChapter } = useMemo(() => {
    const fired = new Set(result.matches.map((m) => m.setupId));
    const linked = new Set(result.matches.map((m) => m.payoffId));
    const uncertain = new Set(result.uncertain);
    const inEnding = new Set(result.inEnding ?? []);
    const info = new Map<string, Info>();
    const marksByChapter = new Map<number, HighlightMark[]>();
    const add = (chapter: number, m: HighlightMark, summary: string) => {
      info.set(m.id, { kind: m.kind, state: m.state, uncertain: uncertain.has(m.id), summary });
      const list = marksByChapter.get(chapter) ?? [];
      list.push(m);
      marksByChapter.set(chapter, list);
    };
    for (const s of result.setups) {
      const state = fired.has(s.id) ? "fired" : inEnding.has(s.id) ? "inEnding" : "unfired";
      add(s.chapter, { id: s.id, start: s.start, end: s.end, kind: "setup", state }, s.summary);
    }
    for (const p of result.payoffs) {
      const state = linked.has(p.id) ? "linked" : "unlinked";
      add(p.chapter, { id: p.id, start: p.start, end: p.end, kind: "payoff", state }, p.summary);
    }
    return { info, marksByChapter };
  }, [result]);

  useEffect(() => {
    if (!target) return;
    const el = document.getElementById(markElementId(target.id));
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // "start" plus the mark's scroll margin lands it just under the sticky tabs.
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
    el.classList.remove("mark-flash");
    void el.offsetWidth; // restart the flash on repeat visits
    el.classList.add("mark-flash");
  }, [target]);

  /** Clicking any other highlight brings the rest back. */
  function onClick(e: React.MouseEvent) {
    if (!focusId || !target) return;
    const mark = (e.target as HTMLElement).closest("mark");
    if (mark && !mark.classList.contains("mark-target")) setDismissed(target.seq);
  }

  const hasUncertain = result.uncertain.length > 0;

  return (
    <article className={`flex flex-col gap-10 ${focusId ? "story-focus" : ""}`} onClick={onClick}>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft" aria-label="Key">
        <li><span className="mark mark-setup-fired">Setup that fires</span></li>
        <li><span className="mark mark-setup-unfired">Setup that never fires</span></li>
        <li><span className="mark mark-payoff-linked">Payoff</span></li>
        <li><span className="mark mark-payoff-unlinked">Payoff with no setup</span></li>
        {(result.inEnding?.length ?? 0) > 0 && (
          <li><span className="mark mark-setup-inEnding">Setup in the ending</span></li>
        )}
        {hasUncertain && <li><span className="mark mark-uncertain">Uncertain</span></li>}
      </ul>

      {focusId && target && (
        <div className="sticky top-16 z-[5] -mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setDismissed(target.seq)}
            className="min-h-11 rounded-sm border border-ink bg-paper px-4 text-sm font-medium shadow-sm transition-colors hover:bg-ink hover:text-paper"
          >
            Show all highlights
          </button>
        </div>
      )}

      {result.chapters.map((c) => {
        const segments = highlightSegments(c.text, marksByChapter.get(c.index) ?? []);
        const seen = new Set<string>();
        const failed = result.failedChapters.includes(c.index);
        return (
          <section key={c.index} aria-labelledby={`story-ch-${c.index}`} className="max-w-[68ch]">
            <h3 id={`story-ch-${c.index}`} className="font-display text-3xl">
              {c.title || `Chapter ${c.index}`}
            </h3>
            {failed && (
              <p className="mt-1 text-sm italic text-muted">This chapter couldn&apos;t be analysed.</p>
            )}
            <div className="mt-4 whitespace-pre-wrap font-serif text-[1.075rem] leading-[1.8]">
              {segments.map((seg, i) => {
                if (seg.marks.length === 0) return <span key={i}>{seg.text}</span>;
                const infos = seg.marks
                  .map((id) => ({ id, i: info.get(id) }))
                  .filter((x): x is { id: string; i: Info } => !!x.i);
                const top = infos.sort((a, b) => rank(a.i) - rank(b.i))[0];
                // The first segment of each mark carries its anchor id.
                const anchor = seg.marks.find((id) => !seen.has(id));
                seg.marks.forEach((id) => seen.add(id));
                const isTarget = focusId !== null && seg.marks.includes(focusId);
                return (
                  <mark
                    key={i}
                    id={anchor ? markElementId(anchor) : undefined}
                    tabIndex={anchor ? -1 : undefined}
                    className={`${top ? markClass(top.i) : "mark"}${isTarget ? " mark-target" : ""}`}
                    title={infos.map((x) => x.i.summary).join("\n")}
                  >
                    {seg.text}
                  </mark>
                );
              })}
            </div>
          </section>
        );
      })}
    </article>
  );
}
