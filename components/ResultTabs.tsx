"use client";

import { startTransition, useId, useRef, useState, ViewTransition } from "react";
import type { AnalysisResult } from "@/lib/types";
import {
  activeOverrides,
  loadOverrides,
  saveOverrides,
  storyKey,
  type Override,
  type Overrides,
} from "@/lib/view/overrides";
import Summary from "@/components/report/Summary";
import ArcMap from "@/components/report/ArcMap";
import TensionChart from "@/components/report/TensionChart";
import IssueList from "@/components/report/IssueList";
import Divider from "@/components/report/Divider";
import FiredList from "@/components/report/FiredList";
import StoryView from "@/components/story/StoryView";

type Tab = "report" | "story";
const TABS: { id: Tab; label: string }[] = [
  { id: "report", label: "Report" },
  { id: "story", label: "Story" },
];

export default function ResultTabs({ result }: { result: AnalysisResult }) {
  const id = useId();
  const [tab, setTab] = useState<Tab>("report");
  // `seq` makes repeat clicks on the same issue scroll again.
  const [target, setTarget] = useState<{ id: string; seq: number } | null>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ report: null, story: null });
  // The writer's calls on guns the tool says never fire, remembered per story.
  // (The page remounts this component for each new result, so the key is fixed here.)
  const [key] = useState(() => storyKey(result));
  const [saved, setSaved] = useState<Overrides>(() => loadOverrides(key));
  const overrides = activeOverrides(result, saved);

  function decide(setupId: string, call: Override | null) {
    const next = { ...saved };
    if (call) next[setupId] = call;
    else delete next[setupId];
    setSaved(next);
    saveOverrides(key, next);
  }

  function select(next: Tab, focus = false) {
    // A transition, so the <ViewTransition> below draws the curtain between views.
    startTransition(() => setTab(next));
    if (focus) tabRefs.current[next]?.focus();
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

  return (
    <section aria-label="Results">
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
                <Summary result={result} overrides={overrides} />
                <Divider />
                {/* The guns that never fire are why writers come, so they lead the report. */}
                <div className="flex flex-col gap-6">
                  <IssueList result={result} overrides={overrides} onDecide={decide} onSelect={openInStory} />
                  <FiredList result={result} overrides={overrides} onDecide={decide} onSelect={openInStory} />
                </div>
                <Divider />
                <ArcMap result={result} overrides={overrides} />
                <Divider />
                <TensionChart result={result} />
              </div>
            ) : (
              <StoryView result={result} overrides={overrides} target={target} />
            )}
          </div>
        </ViewTransition>
      </div>
    </section>
  );
}
