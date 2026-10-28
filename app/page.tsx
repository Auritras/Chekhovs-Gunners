"use client";

import { useEffect, useRef, useState } from "react";
import InputPanel from "@/components/InputPanel";
import RunStatus, { type RunState } from "@/components/RunStatus";
import ResultTabs from "@/components/ResultTabs";
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
      <header className="curtain pb-10 pt-8 sm:pb-14 sm:pt-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-8">
          <h1 className="font-display text-[2.6rem] leading-[1.05] sm:text-7xl">
            Chekhov’s Gunners
          </h1>
          <p className="mt-2 font-display text-xl italic opacity-90 sm:text-2xl">
            Every gun you plant should fire.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8 sm:py-12">
        <div className="max-w-3xl">
          <p className="mb-6 max-w-[62ch] font-serif text-[1.05rem] leading-relaxed text-ink-soft">
            Paste a story or upload a manuscript. We read it chapter by chapter, note every
            setup it plants, and show you which ones pay off — and which are left on the wall.
          </p>
          <InputPanel
            onAnalyse={onAnalyse}
            onViewSample={onViewSample}
            disabled={run.phase === "running"}
          />
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
