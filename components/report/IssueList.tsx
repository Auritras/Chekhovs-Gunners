"use client";

import { useState } from "react";
import type { AnalysisResult, Setup } from "@/lib/types";
import { isWriterGun, type Override, type Overrides } from "@/lib/view/overrides";

const IMPORTANCE = { 1: "Minor", 2: "Notable", 3: "Major" } as const;

const smallButton =
  "min-h-11 rounded-sm border px-3 text-sm font-medium transition-colors";

export default function IssueList({
  result,
  overrides,
  onDecide,
  onSelect,
  onAddGun,
  onRemoveGun,
}: {
  result: AnalysisResult;
  overrides: Overrides;
  onDecide: (setupId: string, call: Override | null) => void;
  onSelect: (setupId: string) => void;
  /** Select a line in the story that plants a gun the tool missed. */
  onAddGun?: () => void;
  onRemoveGun?: (setupId: string) => void;
}) {
  // Which card has its chapter picker open.
  const [picking, setPicking] = useState<string | null>(null);
  // "Not a gun" takes the card off the wall (slides out) before it moves to "Set aside";
  // Undo brings it back sliding in.
  const [leaving, setLeaving] = useState<string | null>(null);
  const [returning, setReturning] = useState<string | null>(null);
  function setAsideGun(id: string) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onDecide(id, { kind: "dismissed" });
      return;
    }
    setLeaving(id);
    setTimeout(() => {
      setLeaving(null);
      onDecide(id, { kind: "dismissed" });
    }, 380);
  }
  function undoSetAside(id: string) {
    setReturning(id);
    onDecide(id, null);
  }
  const uncertain = new Set(result.uncertain);
  const unfired = new Set(result.unfired);
  const all: Setup[] = result.setups
    .filter((s) => unfired.has(s.id))
    .sort(
      (a, b) =>
        Number(uncertain.has(a.id)) - Number(uncertain.has(b.id)) ||
        b.importance - a.importance ||
        a.chapter - b.chapter ||
        a.start - b.start,
    );
  const issues = all.filter((s) => !overrides[s.id]);
  const setAside = all.filter((s) => overrides[s.id]?.kind === "dismissed");
  const chapterTitle = (n: number) =>
    result.chapters.find((c) => c.index === n)?.title || `Chapter ${n}`;

  return (
    <section id="issues" aria-labelledby="issues-heading" className="flex scroll-mt-24 flex-col gap-4">
      <div>
        <h2 id="issues-heading" className="font-display text-3xl">
          Guns that never fire
        </h2>
        <p className="mt-1 max-w-[62ch] text-sm text-ink-soft">
          {issues.length > 0
            ? "Select one to see it in the story. If it does pay off, or isn't really a gun, say so: it's your call."
            : all.length > 0
              ? "Every gun is accounted for."
              : "Every setup we found pays off later in the story."}
        </p>
        {onAddGun && (
          <button
            type="button"
            onClick={onAddGun}
            className="mt-2 min-h-11 text-sm text-ink-soft underline decoration-line underline-offset-4 transition-colors hover:text-ink hover:decoration-current"
          >
            Missed one? Add a gun the tool didn&apos;t find
          </button>
        )}
      </div>
      {issues.length > 0 && (
        <ul className="flex flex-col">
          {issues.map((s) => {
            const unsure = uncertain.has(s.id);
            const laterChapters = result.chapters.filter((c) => c.index >= s.chapter);
            return (
              <li
                key={s.id}
                id={`card-${s.id}`}
                className={`scroll-mt-28 border-t border-line last:border-b ${
                  leaving === s.id ? "card-leave" : returning === s.id ? "card-enter" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className={`group grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-4 pb-3 pt-5 text-left transition-colors hover:bg-surface sm:px-3 ${
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
                      {!isWriterGun(s.id) && <span className="capitalize">{s.kind}</span>}
                      {isWriterGun(s.id) ? (
                        <span className="text-gold">added by you</span>
                      ) : (
                        <span>{IMPORTANCE[s.importance]} importance</span>
                      )}
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

                {/* The writer's call: the tool suggests, the writer decides. */}
                <div className="flex flex-wrap items-center gap-2 pb-5 pl-7 sm:pl-10">
                  <button
                    type="button"
                    aria-expanded={picking === s.id}
                    onClick={() => setPicking((p) => (p === s.id ? null : s.id))}
                    className={`${smallButton} border-brass text-ink hover:bg-brass hover:text-paper`}
                  >
                    It does fire →
                  </button>
                  {isWriterGun(s.id) ? (
                    <button
                      type="button"
                      onClick={() => onRemoveGun?.(s.id)}
                      className={`${smallButton} border-line text-ink-soft hover:border-ink hover:text-ink`}
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAsideGun(s.id)}
                      className={`${smallButton} border-line text-ink-soft hover:border-ink hover:text-ink`}
                    >
                      Not a gun
                    </button>
                  )}
                  {picking === s.id && (
                    <div role="group" aria-label="Where does it pay off?" className="flex w-full flex-wrap gap-2 pt-1">
                      <span className="w-full text-sm text-ink-soft">Where does it pay off?</span>
                      {laterChapters.map((c) => (
                        <button
                          key={c.index}
                          type="button"
                          onClick={() => {
                            setPicking(null);
                            onDecide(s.id, { kind: "fired", chapter: c.index });
                          }}
                          className={`${smallButton} border-line text-left hover:border-brass hover:text-ink`}
                        >
                          {c.title || `Chapter ${c.index}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {setAside.length > 0 && (
        <details id="set-aside" className="group scroll-mt-24 border-b border-line">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 py-3 text-lg marker:hidden [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
              ›
            </span>
            Set aside by you <span className="text-muted tabular-nums">({setAside.length})</span>
          </summary>
          <ul className="flex flex-col pb-2">
            {setAside.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3 sm:px-3">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-ink-soft">{s.summary}</span>
                  <span className="text-xs text-muted">The tool said: never fires · You said: not a gun</span>
                </span>
                <button
                  type="button"
                  onClick={() => undoSetAside(s.id)}
                  className={`${smallButton} border-line text-ink-soft hover:border-ink hover:text-ink`}
                >
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
