"use client";

import { useEffect, useRef, useState } from "react";
import InputPanel from "@/components/InputPanel";
import RunStatus, { type RunState } from "@/components/RunStatus";
import ResultTabs from "@/components/ResultTabs";
import { chapterize } from "@/lib/chapterize";
import { analyze, type Progress } from "@/lib/pipeline/analyze";
import { httpDeps } from "@/lib/pipeline/httpDeps";
import type { AnalysisResult, Chapter } from "@/lib/types";

type Prepared = { chapters: Chapter[]; autoSplit: boolean; wordCount: number };
type Sample = { title: string; result: AnalysisResult };

async function findSample(): Promise<Sample | null> {
  try {
    const index = await fetch("/samples/index.json");
    if (!index.ok) return null;
    const list: unknown = await index.json();
    const first = Array.isArray(list) ? list[0] : null;
    if (!first || typeof first.slug !== "string") return null;
    const res = await fetch(`/samples/${encodeURIComponent(first.slug)}/result.json`);
    if (!res.ok) return null;
    const result = (await res.json()) as AnalysisResult;
    if (!Array.isArray(result?.chapters) || !Array.isArray(result?.setups)) return null;
    return { title: typeof first.title === "string" ? first.title : first.slug, result };
  } catch {
    return null;
  }
}

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
    try {
      const outcome = await analyze(chapters, httpDeps(), onProgress);
      if (id !== runId.current) return;
      if (outcome.status === "ok") {
        setResult(outcome.result);
        setRun({ phase: "done" });
      } else {
        setResult(null);
        setRun({ phase: "quota", sampleAvailable: false });
        const found = await findSample();
        if (id !== runId.current) return;
        setSample(found);
        setRun({ phase: "quota", sampleAvailable: found !== null });
      }
    } catch {
      if (id !== runId.current) return;
      setRun({ phase: "error" });
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

  function onLoadSample() {
    if (!sample) return;
    setResult(sample.result);
    setRun({ phase: "sample", title: sample.title });
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
          <InputPanel onAnalyse={onAnalyse} disabled={run.phase === "running"} />
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
