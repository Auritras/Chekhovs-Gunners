"use client";

import type { Chapter } from "@/lib/types";

export type RunState =
  | { phase: "idle" }
  | { phase: "running"; chapter: number; of: number; stage: "extract" | "waiting" | "match" }
  | { phase: "done" }
  | { phase: "quota"; sampleAvailable: boolean }
  | { phase: "sample"; title: string }
  | { phase: "error" };

const LONG_STORY_WORDS = 25_000;

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-line pl-3 text-sm leading-relaxed text-ink-soft">{children}</p>
  );
}

function Banner({
  children,
  action,
  tone = "curtain",
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  tone?: "curtain" | "ink";
}) {
  const edge = tone === "curtain" ? "border-curtain" : "border-ink";
  return (
    <div
      role="alert"
      className={`flex flex-col gap-3 border-l-4 ${edge} bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between`}
    >
      <p className="text-[0.95rem] leading-snug">{children}</p>
      {action}
    </div>
  );
}

const buttonClass =
  "shrink-0 self-start rounded-sm border border-ink px-3 py-1.5 text-sm font-medium transition-colors hover:bg-ink hover:text-paper sm:self-auto";

/** A row of footlights, one per chapter: lit when read, flickering while being read. */
function Footlights({ of, current, finished }: { of: number; current: number; finished: boolean }) {
  return (
    <ol aria-hidden className="flex flex-wrap gap-1">
      {Array.from({ length: of }, (_, i) => {
        const n = i + 1;
        const done = finished || n < current;
        const live = !finished && n === current;
        return (
          <li
            key={n}
            className={`h-2 w-5 rounded-full ${
              done ? "bg-brass" : live ? "footlight-live bg-curtain" : "bg-line"
            }`}
          />
        );
      })}
    </ol>
  );
}

export default function RunStatus({
  run,
  chapters,
  autoSplit,
  wordCount,
  failedChapters,
  onRetry,
  onLoadSample,
}: {
  run: RunState;
  chapters: Chapter[];
  autoSplit: boolean;
  wordCount: number;
  failedChapters: number[];
  onRetry: (chapter: number) => void;
  onLoadSample: () => void;
}) {
  if (run.phase === "idle") return null;

  const showStoryNotices = run.phase !== "sample";

  return (
    <section aria-label="Analysis status" className="flex max-w-3xl flex-col gap-3">
      {showStoryNotices && autoSplit && (
        <Notice>
          No chapter headings found, so we split the story into parts of about 1,500 words.
        </Notice>
      )}
      {showStoryNotices && wordCount > LONG_STORY_WORDS && (
        <Notice>
          This story is {wordCount.toLocaleString("en-US")} words long. Analysis will take a while
          and may use up today&apos;s free AI quota.
        </Notice>
      )}

      {run.phase === "running" && (
        <div className="flex flex-col gap-2 py-2" aria-live="polite">
          <p className="font-display text-2xl">
            {run.stage === "match"
              ? "Linking setups to their payoffs…"
              : `Analysing chapter ${run.chapter} of ${run.of}`}
          </p>
          {run.stage !== "match" && (
            <p className="text-sm text-ink-soft">
              {run.stage === "waiting"
                ? "waiting for Gemini…"
                : (chapters.find((c) => c.index === run.chapter)?.title ?? "")}
            </p>
          )}
          <Footlights of={run.of} current={run.chapter} finished={run.stage === "match"} />
        </div>
      )}

      {run.phase === "done" &&
        failedChapters.map((k) => (
          <Banner
            key={k}
            action={
              <button type="button" className={buttonClass} onClick={() => onRetry(k)}>
                Retry chapter {k}
              </button>
            }
          >
            Chapter {k} couldn&apos;t be analysed — some results may be wrong.
          </Banner>
        ))}

      {run.phase === "quota" && (
        <Banner
          tone="ink"
          action={
            run.sampleAvailable ? (
              <button type="button" className={buttonClass} onClick={onLoadSample}>
                Load sample analysis
              </button>
            ) : undefined
          }
        >
          Today&apos;s free AI quota is used up. Here&apos;s the sample analysis instead.
        </Banner>
      )}

      {run.phase === "sample" && (
        <Notice>Showing the sample analysis of “{run.title}”.</Notice>
      )}

      {run.phase === "error" && (
        <Banner
          action={
            <button type="button" className={buttonClass} onClick={() => onRetry(1)}>
              Try again
            </button>
          }
        >
          The analysis couldn&apos;t start. Check your connection and try again.
        </Banner>
      )}
    </section>
  );
}
