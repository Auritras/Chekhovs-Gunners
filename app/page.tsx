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

type Prepared = { chapters: Chapter[]; autoSplit: boolean; wordCount: number };
type Sample = { title: string; result: AnalysisResult };

export default function Home() {
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [run, setRun] = useState<RunState>({ phase: "idle" });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [sample, setSample] = useState<Sample | null>(null);
  const runId = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const curtainPlayed = useRef(false);
  const [curtain, setCurtain] = useState(false);
  const closeCurtain = useCallback(() => setCurtain(false), []);

  /** The first report of the visit opens behind full-screen curtains; later ones just appear. */
  function raiseCurtain() {
    if (curtainPlayed.current) return;
    curtainPlayed.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    markCurtainStart();
    setCurtain(true);
  }

  async function start(chapters: Chapter[]) {
    const id = ++runId.current;
    setRun({ phase: "running", chapter: 1, of: chapters.length, stage: "extract" });
    setSample(null);
    const onProgress = (p: Progress) => {
      if (id !== runId.current) return;
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
        raiseCurtain();
        setResult(outcome.result);
        setRun({ phase: "done" });
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
    raiseCurtain();
    setResult(s.result);
    setRun({ phase: "sample", title: s.title });
  }

  function onLoadSample() {
    if (sample) showSample(sample);
  }

  /** A sample picked in the input panel whose prebuilt result exists: show it, no API calls. */
  function onViewSample(result: AnalysisResult, title: string) {
    setSample({ title, result });
    showSample({ title, result });
  }

  // Bring the report into view when a run finishes.
  const showResults = result !== null && (run.phase === "done" || run.phase === "sample");
  useEffect(() => {
    if (!showResults) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [showResults]);

  return (
    <>
      {curtain && <OpeningCurtain onDone={closeCurtain} />}
      <PaperHeader fireKey={showResults ? result : null} />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8 sm:py-12">
        {/* Desktop: the input on the left, a miniature of a real report on the right. */}
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
          <div className="flex min-w-0 flex-col gap-6">
            <p className="max-w-[62ch] font-serif text-[1.05rem] leading-relaxed text-ink-soft">
              Paste a story or upload a manuscript. We read it chapter by chapter, note every
              setup it plants, and show you which ones pay off — and which are left on the wall.
            </p>
            <HowItWorks />
            <InputPanel
              onAnalyse={onAnalyse}
              onViewSample={onViewSample}
              disabled={run.phase === "running"}
            />
          </div>
          <aside aria-label="Sample report" className="lg:sticky lg:top-8">
            <SamplePreview onView={onViewSample} />
          </aside>
        </div>

        <RunStatus
          run={run}
          chapters={prepared?.chapters ?? []}
          autoSplit={prepared?.autoSplit ?? false}
          wordCount={prepared?.wordCount ?? 0}
          failedChapters={run.phase === "done" ? (result?.failedChapters ?? []) : []}
          onRetry={onRetry}
          onLoadSample={onLoadSample}
        />

        {showResults && result && (
          <div ref={resultsRef} className="scroll-mt-4">
            <ResultTabs result={result} />
          </div>
        )}
      </main>

      <footer className="border-t border-line px-4 py-6 text-center text-sm text-muted">
        It suggests; the writer decides. Your text is never changed.
      </footer>
    </>
  );
}
