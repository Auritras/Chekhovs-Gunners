"use client";

import { startTransition, useEffect, useId, useMemo, useRef, useState, ViewTransition } from "react";
import type { AnalysisResult, SetupKind } from "@/lib/types";
import {
  activeOverrides,
  loadGuns,
  loadOverrides,
  saveGuns,
  saveOverrides,
  storyKey,
  withWriterGuns,
  WRITER_GUN_PREFIX,
  type WriterGun,
  type Override,
  type Overrides,
} from "@/lib/view/overrides";
import Summary from "@/components/report/Summary";
import ArcMap from "@/components/report/ArcMap";
import TensionChart from "@/components/report/TensionChart";
import RhythmChart from "@/components/report/RhythmChart";
import IssueList from "@/components/report/IssueList";
import Divider from "@/components/report/Divider";
import KindChips from "@/components/report/KindChips";
import DownloadNotes from "@/components/report/DownloadNotes";
import ShareLink from "@/components/report/ShareLink";
import { storyTitle } from "@/lib/view/recent";
import BiggestLooseEnd from "@/components/report/BiggestLooseEnd";
import DraftChanges from "@/components/report/DraftChanges";
import type { DraftChanges as Changes } from "@/lib/view/compare";
import FiredList from "@/components/report/FiredList";
import StoryView from "@/components/story/StoryView";
import { callAchievements } from "@/lib/view/achievements";
import { unlock } from "@/lib/view/achievementStore";

type Tab = "report" | "story";
const TABS: { id: Tab; label: string }[] = [
  { id: "report", label: "Report" },
  { id: "story", label: "Story" },
];

export default function ResultTabs({
  result,
  title,
  sample = false,
  changes,
  onDismissChanges,
}: {
  result: AnalysisResult;
  title?: string;
  /** A ready-made sample report, not the writer's own story. */
  sample?: boolean;
  /** What changed since the writer's last draft of this story, after a re-run. */
  changes?: Changes | null;
  onDismissChanges?: () => void;
}) {
  const id = useId();
  const [tab, setTab] = useState<Tab>("report");
  // `seq` makes repeat clicks on the same issue scroll again.
  const [target, setTarget] = useState<{ id: string; seq: number } | null>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ report: null, story: null });
  const sectionRef = useRef<HTMLElement>(null);
  // The writer's calls on guns the tool says never fire, remembered per story.
  // (The page remounts this component for each new result, so the key is fixed here.)
  const [key] = useState(() => storyKey(result));
  const [saved, setSaved] = useState<Overrides>(() => loadOverrides(key));
  // Guns the tool never found, added by the writer. `view` is the result the writer sees.
  const [guns, setGuns] = useState<WriterGun[]>(() => loadGuns(key));
  const view = useMemo(() => withWriterGuns(result, guns), [result, guns]);
  const overrides = activeOverrides(view, saved);
  // The writer's own calls unlock achievements (script doctor, red herring, sharp eye, ...).
  useEffect(() => {
    unlock(...callAchievements(view, overrides));
  });

  // Story pick mode: point to where a gun fires, or select a line that plants a missed gun.
  type Pick = { mode: "payoff"; setupId: string; chapter: number } | { mode: "setup" };
  const [pick, setPick] = useState<Pick | null>(null);
  // Filter the lists and the arc map by gun type.
  const [kind, setKind] = useState<SetupKind | null>(null);
  // Filter the lists to one chapter, from the tension chart.
  const [chapter, setChapter] = useState<number | null>(null);
  function filterChapter(next: number | null) {
    setChapter(next);
    if (next === null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("issues")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
  const chapterName = (n: number) => view.chapters.find((c) => c.index === n)?.title || `Chapter ${n}`;
  function pointOut(setupId: string) {
    const call = saved[setupId];
    if (call?.kind !== "fired") return;
    startTransition(() => {
      setPick({ mode: "payoff", setupId, chapter: call.chapter });
      setTab("story");
    });
  }
  function startAddGun() {
    startTransition(() => {
      setTarget(null);
      setPick({ mode: "setup" });
      setTab("story");
    });
  }
  useEffect(() => {
    if (tab !== "story" || pick?.mode !== "payoff") return;
    document.getElementById(`story-ch-${pick.chapter}`)?.scrollIntoView({ block: "start" });
  }, [tab, pick]);

  function addGun(chapter: number, passage: { start: number; end: number; quote: string }, name: string) {
    const q = passage.quote.replace(/\s+/g, " ");
    const gun: WriterGun = {
      id: `${WRITER_GUN_PREFIX}${Date.now().toString(36)}`,
      chapter,
      ...passage,
      summary: name.trim() || (q.length > 70 ? `${q.slice(0, 70).trimEnd()}…` : q),
    };
    const next = [...guns, gun];
    setGuns(next);
    saveGuns(key, next);
    setPick(null);
    // Back to the report, at the new gun's card.
    startTransition(() => {
      setBackTo({ id: gun.id, seq: handledBack.current + 1 });
      setTab("report");
    });
  }
  function removeGun(id: string) {
    const next = guns.filter((g) => g.id !== id);
    setGuns(next);
    saveGuns(key, next);
    decide(id, null);
  }

  function decide(setupId: string, call: Override | null) {
    const next = { ...saved };
    if (call) next[setupId] = call;
    else delete next[setupId];
    setSaved(next);
    saveOverrides(key, next);
  }

  /** A plain tab switch: the Story tab opens as the normal story, not the last jump. */
  function select(next: Tab, focus = false) {
    if (next === tab) return;
    // A transition, so the <ViewTransition> below draws the curtain between views.
    startTransition(() => {
      if (next === "story") setTarget(null);
      setTab(next);
    });
    if (focus) tabRefs.current[next]?.focus();
    // Start the other view from its top, not from wherever this one was scrolled to.
    const top = sectionRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) sectionRef.current?.scrollIntoView({ block: "start" });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const i = TABS.findIndex((t) => t.id === tab);
    let j = -1;
    if (e.key === "ArrowRight") j = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = TABS.length - 1;
    if (j < 0) return;
    e.preventDefault();
    select(TABS[j].id, true);
  }

  function openInStory(setupId: string) {
    startTransition(() => {
      setTarget((prev) => ({ id: setupId, seq: (prev?.seq ?? 0) + 1 }));
      setTab("story");
    });
  }

  // "Back to report": return to the card the writer jumped from.
  const [backTo, setBackTo] = useState<{ id: string; seq: number } | null>(null);
  const handledBack = useRef(0);
  function backToReport() {
    if (!target) return;
    const card = { id: target.id, seq: handledBack.current + 1 };
    startTransition(() => {
      setBackTo(card);
      setTab("report");
    });
  }
  useEffect(() => {
    // Only once per return, not every later visit to the Report tab.
    if (tab !== "report" || !backTo || backTo.seq === handledBack.current) return;
    handledBack.current = backTo.seq;
    const el = document.getElementById(`card-${backTo.id}`);
    if (!el) return;
    const list = el.closest("details");
    if (list) list.open = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    el.classList.remove("card-return");
    void el.offsetWidth; // restart the highlight on repeat returns
    el.classList.add("card-return");
  }, [tab, backTo]);


  return (
    <section ref={sectionRef} aria-label="Results">
      <div
        role="tablist"
        aria-label="Results"
        onKeyDown={onKeyDown}
        className="sticky top-0 z-10 -mx-4 flex gap-6 border-b border-line bg-paper px-4 sm:mx-0 sm:px-0"
      >
        {TABS.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${t.id}`}
              aria-controls={`${id}-panel-${t.id}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.id)}
              className={`-mb-px border-b-2 py-3 font-display text-2xl transition-colors ${
                selected
                  ? "border-curtain text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${id}-panel-${tab}`}
        aria-labelledby={`${id}-tab-${tab}`}
        className="pt-8"
      >
        <ViewTransition key={tab} name="result-panel" share="curtain" enter="curtain" default="none">
          <div>
            {tab === "report" ? (
              <div className="flex flex-col gap-10">
                <div className="flex flex-col gap-6">
                  {changes && (
                    <DraftChanges changes={changes} onSelect={openInStory} onDismiss={() => onDismissChanges?.()} />
                  )}
                  {/* The counts and the notes share a row; the notes wrap below on narrow screens. */}
                  <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
                    <div className="min-w-0">
                      <Summary result={view} overrides={overrides} awardStory={!sample} />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <DownloadNotes result={view} overrides={overrides} title={title} />
                      <ShareLink result={result} overrides={saved} guns={guns} title={title ?? storyTitle(result)} />
                    </div>
                  </div>
                  <BiggestLooseEnd result={view} overrides={overrides} onSelect={openInStory} />
                </div>
                <Divider />
                {/* The guns that never fire are why writers come, so they lead the report. */}
                <div className="flex flex-col gap-6">
                  <KindChips setups={view.setups} kind={kind} onChange={setKind} />
                  {chapter !== null && (
                    <p className="-mt-2 text-sm text-ink-soft">
                      Showing guns planted or fired in {chapterName(chapter)}.{" "}
                      <button
                        type="button"
                        onClick={() => setChapter(null)}
                        className="min-h-11 text-brass underline decoration-line underline-offset-4 hover:text-ink"
                      >
                        Show all chapters
                      </button>
                    </p>
                  )}
                  <IssueList
                    result={view}
                    overrides={overrides}
                    onDecide={decide}
                    onSelect={openInStory}
                    onAddGun={startAddGun}
                    onRemoveGun={removeGun}
                    kind={kind}
                    chapter={chapter}
                  />
                  <FiredList
                    result={view}
                    overrides={overrides}
                    onDecide={decide}
                    onSelect={openInStory}
                    onPointOut={pointOut}
                    kind={kind}
                    chapter={chapter}
                  />
                </div>
                <Divider />
                {/* The same filter again, so it's at hand when exploring the map. */}
                <div className="flex flex-col gap-4">
                  <KindChips setups={view.setups} kind={kind} onChange={setKind} />
                  {kind && (
                    <p className="-mt-1 text-sm text-ink-soft">
                      {view.setups.some(
                        (s) => s.kind === kind && (view.matches.some((m) => m.setupId === s.id) || overrides[s.id]?.kind === "fired"),
                      )
                        ? `Showing ${kind} guns only.`
                        : `No ${kind} gun fires yet, so no arc is lit.`}{" "}
                      <button
                        type="button"
                        onClick={() => setKind(null)}
                        className="min-h-11 text-brass underline decoration-line underline-offset-4 hover:text-ink"
                      >
                        Show all
                      </button>
                    </p>
                  )}
                  <ArcMap result={view} overrides={overrides} kind={kind} />
                </div>
                <Divider />
                <TensionChart result={result} chapter={chapter} onChapter={filterChapter} />
                <Divider />
                <RhythmChart result={view} overrides={overrides} />
              </div>
            ) : (
              <StoryView
                onSelect={openInStory}
                result={view}
                overrides={overrides}
                target={target}
                onBack={target ? backToReport : undefined}
                pick={
                  pick?.mode === "payoff"
                    ? { ...pick, summary: view.setups.find((s) => s.id === pick.setupId)?.summary ?? "" }
                    : pick
                }
                onPicked={(chapter, passage, name) => {
                  if (!pick) return;
                  if (pick.mode === "setup") return addGun(chapter, passage, name ?? "");
                  decide(pick.setupId, { kind: "fired", chapter, ...passage });
                  setPick(null);
                }}
                onAddGun={startAddGun}
                onCancelPick={() => setPick(null)}
              />
            )}
          </div>
        </ViewTransition>
      </div>
    </section>
  );
}
