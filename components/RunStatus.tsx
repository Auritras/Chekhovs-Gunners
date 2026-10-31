"use client";

import { useEffect, useState } from "react";
import FoundWall, { type WallItem } from "@/components/effects/FoundWall";
import QuoteRotator from "@/components/effects/QuoteRotator";
import type { Chapter } from "@/lib/types";

export type RunState =
  | { phase: "idle" }
  | { phase: "running"; chapter: number; of: number; stage: "extract" | "waiting" | "match" }
  | { phase: "done" }
  | { phase: "quota"; sampleAvailable: boolean }
  | { phase: "sample"; title: string }
  /** `allFailed`: the run finished but no chapter could be analysed. */
  | { phase: "error"; allFailed: boolean; sampleAvailable: boolean };

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

/** Time on stage so far, so a long chapter still visibly moves. */
function Elapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span aria-hidden className="tabular-nums text-muted">
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
    </span>
  );
}

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
            className={`relative h-2 w-5 overflow-hidden rounded-full ${live ? "footlight-live bg-curtain" : "bg-line"}`}
          >
            {/* A finished chapter's light fills like ink spreading, instead of snapping on. */}
            {done && <span className="ink-fill absolute inset-0 bg-brass" />}
          </li>
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
  wall = [],
}: {
  run: RunState;
  chapters: Chapter[];
  autoSplit: boolean;
  wordCount: number;
  failedChapters: number[];
  onRetry: (chapter: number) => void;
  onLoadSample: () => void;
  wall?: WallItem[];
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
          This story is {wordCount.toLocaleString("en-US")} words long. This may take a while
          (Tolstoy took six years), and it may use up today&apos;s free AI quota.
        </Notice>
      )}

      {run.phase === "running" && (
        <div className="flex flex-col gap-2 py-2" aria-live="polite">
          <p className="font-display text-2xl">
            {run.stage === "match"
              ? "Following every gun to its payoff"
              : `Reading chapter ${run.chapter} of ${run.of}`}
            <span aria-hidden className="working-dots" />
          </p>
          <p className="flex flex-wrap gap-x-3 text-sm text-ink-soft">
            <span>
              {run.stage === "waiting"
                ? "The house is busy, so we're holding the curtain for a moment."
                : run.stage === "match"
                  ? "Last scene: checking which setups pay off."
                  : (chapters.find((c) => c.index === run.chapter)?.title ?? "")}
            </span>
            <Elapsed />
          </p>
          <Footlights of={run.of} current={run.chapter} finished={run.stage === "match"} />
          <div className="mt-4">
            <FoundWall items={wall} />
          </div>
          <div className="mt-4">
            <QuoteRotator />
          </div>
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
          {run.sampleAvailable
            ? "Today's free AI quota is used up. Here's the sample analysis instead."
            : "Today's free AI quota is used up. Please try again tomorrow."}
        </Banner>
      )}

      {run.phase === "sample" && (
        <Notice>Showing the sample analysis of “{run.title}”.</Notice>
      )}

      {run.phase === "error" && (
        <Banner
          action={
            <div className="flex shrink-0 flex-wrap gap-2 self-start sm:self-auto">
              <button type="button" className={buttonClass} onClick={() => onRetry(1)}>
                Try again
              </button>
              {run.sampleAvailable && (
                <button type="button" className={buttonClass} onClick={onLoadSample}>
                  Load sample analysis
                </button>
              )}
            </div>
          }
        >
          {run.allFailed
            ? "None of the chapters could be analysed — the AI service may be unavailable. Try again in a little while."
            : "The analysis couldn't start. Check your connection and try again."}
          {run.sampleAvailable && " Meanwhile, you can look at the sample analysis."}
        </Banner>
      )}
    </section>
  );
}
