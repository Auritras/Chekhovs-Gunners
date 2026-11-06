"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import InputPanel from "@/components/InputPanel";
import RunStatus, { type RunState } from "@/components/RunStatus";
import ResultTabs from "@/components/ResultTabs";
import OpeningCurtain, { markCurtainStart } from "@/components/effects/OpeningCurtain";
import PaperHeader from "@/components/effects/PaperHeader";
import AchievementToasts from "@/components/effects/AchievementToasts";
import KeyboardHelp from "@/components/KeyboardHelp";
import CurtainCall from "@/components/effects/CurtainCall";
import { unlock } from "@/lib/view/achievementStore";
import { useStageTitle } from "@/components/effects/useStageTitle";
import HowItWorks from "@/components/landing/HowItWorks";
import SamplePreview from "@/components/landing/SamplePreview";
import { chapterize } from "@/lib/chapterize";
import { analyze, everyChapterFailed, type Progress } from "@/lib/pipeline/analyze";
import { httpDeps } from "@/lib/pipeline/httpDeps";
import { findSampleWithResult } from "@/lib/samples";
import type { AnalysisResult, Chapter } from "@/lib/types";
import type { WallItem } from "@/components/effects/FoundWall";
import { loadGuns, loadOverrides, saveGuns, saveOverrides, storyKey } from "@/lib/view/overrides";
import { loadRecent, removeRecent, saveRecent, type RecentReport } from "@/lib/view/recent";
import { decodeReport } from "@/lib/view/share";
import RecentReports from "@/components/landing/RecentReports";
import { changesSinceLastDraft, type DraftChanges } from "@/lib/view/compare";

type Prepared = { chapters: Chapter[]; autoSplit: boolean; wordCount: number };
type Sample = { title: string; result: AnalysisResult };

export default function Home() {
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [run, setRun] = useState<RunState>({ phase: "idle" });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [sample, setSample] = useState<Sample | null>(null);
  // After a re-run of an edited story: what changed since the last draft.
  const [changes, setChanges] = useState<DraftChanges | null>(null);
  // The writer's last few reports, to reopen (read after mount: the server can't see them).
  const [recent, setRecent] = useState<RecentReport[]>([]);
  // The live "Found" wall shown while a story is read.
  const [wall, setWall] = useState<WallItem[]>([]);
  useStageTitle(run);
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

  /** A shared report's link stops describing the page once something else is shown. */
  function clearShareLink() {
    if (window.location.hash.startsWith("#r=")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  /** Show a report from a shared link or the recent list: no AI calls. */
  function reopen(report: AnalysisResult, run: Extract<RunState, { phase: "reopened" }>) {
    runId.current++; // ignore any run still reporting progress
    reveal(() => {
      setChanges(null);
      setResult(report);
      setRun(run);
    });
  }

  // On arrival: recent reports, and a report shared in the link (if any).
  useEffect(() => {
    const id = setTimeout(() => setRecent(loadRecent()), 0);
    void decodeReport(window.location.hash).then((shared) => {
      if (!shared) return;
      // The sharer's calls come along, unless this browser already has its own for the story.
      const key = storyKey(shared.result);
      if (Object.keys(loadOverrides(key)).length === 0) saveOverrides(key, shared.overrides);
      if (loadGuns(key).length === 0) saveGuns(key, shared.guns);
      reopen(shared.result, { phase: "reopened", title: shared.title || "a story", shared: true });
    });
    return () => clearTimeout(id);
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Achievements for finishing an analysis of the writer's own story. */
  function runAchievements(chapters: Chapter[]): string[] {
    const ids = ["opening-night"];
    let runs = 1;
    try {
      runs = Number(window.localStorage.getItem("cg-runs") ?? "0") + 1;
      window.localStorage.setItem("cg-runs", String(runs));
    } catch {
      // Storage blocked: count this run only.
    }
    if (runs >= 2) ids.push("encore");
    const words = chapters.reduce((n, c) => n + c.text.split(/\s+/).filter(Boolean).length, 0);
    if (words >= 10_000) ids.push("marathon");
    if (new Date().getHours() < 4) ids.push("night-owl");
    if (document.hidden) ids.push("intermission");
    return ids;
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
        unlock(...runAchievements(chapters));
        const since = changesSinceLastDraft(outcome.result);
        setRecent(saveRecent(outcome.result));
        reveal(() => {
          setChanges(since);
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
    clearShareLink();
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
    clearShareLink();
    runId.current++; // ignore any run still reporting progress
    reveal(() => {
      setChanges(null);
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
  const showResults =
    result !== null && (run.phase === "done" || run.phase === "sample" || run.phase === "reopened");
  const compact = (running || showResults) && !editing;
  useEffect(() => {
    if (!showResults) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [showResults]);

  return (
    <>
      <AchievementToasts />
      <KeyboardHelp />
      <CurtainCall />
      {curtain && <OpeningCurtain onClosed={curtainClosed} onDone={closeCurtain} />}
      {/* The gun on the wall fires only when the story left guns unfired. */}
      <PaperHeader fireKey={showResults && result && result.unfired.length > 0 ? result : null} />

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
            {!compact && (
              <RecentReports
                reports={recent}
                onOpen={(r) => {
                  clearShareLink();
                  reopen(r.result, { phase: "reopened", title: r.title, shared: false, at: r.at });
                }}
                onForget={(key) => setRecent(removeRecent(key))}
              />
            )}
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
            <ResultTabs
              key={storyKey(result)}
              result={result}
              title={run.phase === "sample" || run.phase === "reopened" ? run.title : undefined}
              sample={run.phase === "sample" || (run.phase === "reopened" && run.shared)}
              changes={run.phase === "done" ? changes : null}
              onDismissChanges={() => setChanges(null)}
            />
          </div>
        )}
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 border-t border-line px-4 py-6 text-center text-sm text-muted">
        {/* Hover (or tap) the motto and a little figure on stage takes a bow to the writer. */}
        <span tabIndex={0} className="bow-group inline-flex items-center gap-2 rounded-sm outline-offset-4">
          <svg viewBox="0 0 20 24" aria-hidden className="h-6 w-5 text-brass">
            <line x1="0" y1="23.5" x2="20" y2="23.5" stroke="currentColor" strokeWidth="1" />
            <path d="M10 16 L7 23 M10 16 L13 23" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <g className="bow-upper">
              <path d="M10 16 L10 9 M10 11 L6.5 14 M10 11 L13.5 14" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <circle cx="10" cy="6" r="2.4" fill="currentColor" />
            </g>
          </svg>
          It suggests; the writer decides.
        </span>
        <span>Your text is never changed.</span>
      </footer>
    </>
  );
}
