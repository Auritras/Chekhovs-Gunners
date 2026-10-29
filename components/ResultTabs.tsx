"use client";

import { useId, useRef, useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import Summary from "@/components/report/Summary";
import ArcMap from "@/components/report/ArcMap";
import TensionChart from "@/components/report/TensionChart";
import IssueList from "@/components/report/IssueList";
import Divider from "@/components/report/Divider";
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

  function select(next: Tab, focus = false) {
    setTab(next);
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
    setTarget((prev) => ({ id: setupId, seq: (prev?.seq ?? 0) + 1 }));
    setTab("story");
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
        {tab === "report" ? (
          <div className="flex flex-col gap-10">
            <Summary result={result} />
            <Divider />
            {/* The guns that never fire are why writers come, so they lead the report. */}
            <IssueList result={result} onSelect={openInStory} />
            <Divider />
            <ArcMap result={result} />
            <Divider />
            <TensionChart result={result} />
          </div>
        ) : (
          <StoryView result={result} target={target} />
        )}
      </div>
    </section>
  );
}
