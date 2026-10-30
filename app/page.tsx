"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import InputPanel from "@/components/InputPanel";
import RunStatus, { type RunState } from "@/components/RunStatus";
import ResultTabs from "@/components/ResultTabs";
import OpeningCurtain, { markCurtainStart } from "@/components/effects/OpeningCurtain";
import PaperHeader from "@/components/effects/PaperHeader";
import HowItWorks from "@/components/landing/HowItWorks";
import SamplePreview from "@/components/landing/SamplePreview";
import { chapterize } from "@/lib/chapterize";
import { analyze, everyChapterFailed, type Progress } from "@/lib/pipeline/analyze";
import { httpDeps } from "@/lib/pipeline/httpDeps";
import { findSampleWithResult } from "@/lib/samples";
import type { AnalysisResult, Chapter } from "@/lib/types";
import type { WallItem } from "@/components/effects/FoundWall";
import { storyKey } from "@/lib/view/overrides";

type Prepared = { chapters: Chapter[]; autoSplit: boolean; wordCount: number };
type Sample = { title: string; result: AnalysisResult };

export default function Home() {
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [run, setRun] = useState<RunState>({ phase: "idle" });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [sample, setSample] = useState<Sample | null>(null);
  // The live "Found" wall shown while a story is read.
  const [wall, setWall] = useState<WallItem[]>([]);
  const runId = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const curtainPlayed = useRef(false);
  const [curtain, setCurtain] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  // While analysing or showing a report the story box folds away, until the writer asks to edit.
  const [editing, setEditing] = useState(false);
  const closeCurtain = useCallback(() => setCurtain(false), []);
  // The report waiting behind the closed curtain.
  const pendingReveal = useRef<(() => void) | null>(null);
  const curtainClosed = useCallback(() => {
    pendingReveal.current?.();
    pendingReveal.current = null;
  }, []);

  /**
   * Show a report. The first of the visit plays the curtains: they close over the page,
   * the report is put in place behind them, then they part. Later reports just appear.
   */
  function reveal(show: () => void) {
    if (curtainPlayed.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      curtainPlayed.current = true;
      show();
      return;
    }
    curtainPlayed.current = true;
    markCurtainStart();
    pendingReveal.current = show;
    setCurtain(true);
  }

  async function start(chapters: Chapter[]) {
    const id = ++runId.current;
    setRun({ phase: "running", chapter: 1, of: chapters.length, stage: "extract" });
    setSample(null);
    setWall([]);
    const onProgress = (p: Progress) => {
      if (id !== runId.current) return;
      if (p.stage === "found" || p.stage === "linked") {
        const fired = new Map(p.fired.map((f) => [f.setupId, f.chapter]));
        const added: WallItem[] = p.stage === "found" ? p.setups : [];
        setWall((w) =>
          [...w, ...added].map((g) =>
            fired.has(g.id) && g.firedIn === undefined ? { ...g, firedIn: fired.get(g.id) } : g,
          ),
        );
        return;
      }
      setRun((prev) => {
        const base =
          prev.phase === "running"
            ? prev
            : ({ phase: "running", chapter: 1, of: chapters.length, stage: "extract" } as const);
        if (p.stage === "extract") return { ...base, chapter: p.chapter, of: p.of, stage: "extract" };
        if (p.stage === "waiting") return { ...base, stage: "waiting" };
        if (p.stage === "match") return { ...base, chapter: base.of, stage: "match" };
        return base;
      });
    };
    /** Look up the prebuilt sample result (if any) for a fallback offer. */
    async function offerSample(): Promise<boolean | null> {
      const found = await findSampleWithResult();
      if (id !== runId.current) return null;
      setSample(found);
      return found !== null;
    }

    try {
      const outcome = await analyze(chapters, httpDeps(), onProgress);
      if (id !== runId.current) return;
      if (outcome.status === "ok" && !everyChapterFailed(outcome.result)) {
        reveal(() => {
          setResult(outcome.result);
          setRun({ phase: "done" });
        });
        return;
      }
      setResult(null);
      const sampleAvailable = await offerSample();
      if (sampleAvailable === null) return;
      setRun(
        outcome.status === "ok"
          ? { phase: "error", allFailed: true, sampleAvailable }
          : { phase: "quota", sampleAvailable },
      );
    } catch (e) {
      if (id !== runId.current) return;
      console.error("Analysis failed:", e);
      setResult(null);
      const sampleAvailable = await offerSample();
      if (sampleAvailable === null) return;
      setRun({ phase: "error", allFailed: false, sampleAvailable });
    }
  }

  function onAnalyse(text: string) {
    setEditing(false);
    const p = chapterize(text);
    setPrepared(p);
    setResult(null);
    void start(p.chapters);
  }

  function onRetry() {
    if (prepared) void start(prepared.chapters);
  }

  function showSample(s: Sample) {
    runId.current++; // ignore any run still reporting progress
    reveal(() => {
      setResult(s.result);
      setRun({ phase: "sample", title: s.title });
    });
  }

  function onLoadSample() {
    if (sample) showSample(sample);
  }

  /** A sample picked in the input panel whose prebuilt result exists: show it, no API calls. */
  function onViewSample(result: AnalysisResult, title: string) {
    setSample({ title, result });
    showSample({ title, result });
  }

  // Bring the progress into view when a run starts: it sits below the fold otherwise.
  const running = run.phase === "running";
  useEffect(() => {
    if (!running) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    statusRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [running]);

  // Bring the report into view when a run finishes.
  const showResults = result !== null && (run.phase === "done" || run.phase === "sample");
  const compact = (running || showResults) && !editing;
  useEffect(() => {
    if (!showResults) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [showResults]);

  return (
    <>
      {curtain && <OpeningCurtain onClosed={curtainClosed} onDone={closeCurtain} />}
      <PaperHeader fireKey={showResults ? result : null} />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8 sm:py-12">
        {/* Desktop: the input on the left, a miniature of a real report on the right
            (hidden once the writer has a report of their own to look at). */}
        <div
          className={`grid items-start gap-8 lg:gap-10 ${showResults ? "" : "lg:grid-cols-[minmax(0,1fr)_18rem]"}`}
        >
          <div className="flex min-w-0 flex-col gap-6">
            <p className="max-w-[62ch] font-serif text-[1.05rem] leading-relaxed text-ink-soft">
              Paste a story or upload a manuscript. We read it chapter by chapter, note every
              setup it plants, and show you which ones pay off — and which are left on the wall.
            </p>
            {!compact && <HowItWorks />}
            <InputPanel
              onAnalyse={onAnalyse}
              onViewSample={onViewSample}
              disabled={running}
              compact={compact}
              onEdit={() => setEditing(true)}
            />
          </div>
          {!showResults && (
            <aside aria-label="Sample report" className="lg:sticky lg:top-8">
              <SamplePreview onView={onViewSample} />
            </aside>
          )}
        </div>

        <div ref={statusRef} className="scroll-mt-4">
        <RunStatus
          run={run}
          chapters={prepared?.chapters ?? []}
          autoSplit={prepared?.autoSplit ?? false}
          wordCount={prepared?.wordCount ?? 0}
          failedChapters={run.phase === "done" ? (result?.failedChapters ?? []) : []}
          onRetry={onRetry}
          onLoadSample={onLoadSample}
          wall={wall}
        />
        </div>

        {showResults && result && (
          <div ref={resultsRef} className="scroll-mt-4">
            <ResultTabs key={storyKey(result)} result={result} />
          </div>
        )}
      </main>

      <footer className="border-t border-line px-4 py-6 text-center text-sm text-muted">
        It suggests; the writer decides. Your text is never changed.
      </footer>
    </>
  );
}
