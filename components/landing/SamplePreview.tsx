"use client";

import { useEffect, useMemo, useState } from "react";
import { findSampleWithResult } from "@/lib/samples";
import type { AnalysisResult } from "@/lib/types";
import { layoutArcs } from "@/lib/view/arcLayout";
import { summaryCounts } from "@/lib/view/summaryCounts";

const W = 280;
const BASE = 96;
const H = 128;

/** A miniature of a real saved report, so the page shows what the tool makes before anyone types. */
export default function SamplePreview({
  onView,
}: {
  onView: (result: AnalysisResult, title: string) => void;
}) {
  const [sample, setSample] = useState<{ title: string; result: AnalysisResult } | null | undefined>();

  useEffect(() => {
    let cancelled = false;
    void findSampleWithResult().then((s) => {
      if (!cancelled) setSample(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const layout = useMemo(() => (sample ? layoutArcs(sample.result, W) : null), [sample]);

  if (sample === null) return null;

  const counts = sample ? summaryCounts(sample.result) : null;
  const unfired = layout?.nodes.filter((n) => n.kind === "setup" && n.state === "unfired") ?? [];

  return (
    <figure className="flex flex-col gap-4 border border-line bg-surface p-5">
      <figcaption className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-[0.2em] text-ink-soft">What you get</span>
        <span className="font-display text-xl leading-tight">
          {sample ? `“${sample.title}”, analysed` : "Loading a sample report…"}
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden>
        {layout && (
          <>
            {layout.chapterTicks.map((t) => (
              <line key={t.chapter} x1={t.x} x2={t.x} y1={8} y2={H - 4} stroke="var(--line)" />
            ))}
            <line x1={0} x2={W} y1={BASE} y2={BASE} stroke="var(--ink)" strokeWidth="1" />
            {layout.arcs.map((a) => {
              const rx = Math.max(Math.abs(a.x2 - a.x1) / 2, 3);
              const ry = Math.min(Math.max(Math.abs(a.height) * 0.5, 6), BASE - 12);
              return (
                <path
                  key={`${a.setupId}-${a.payoffId}`}
                  d={`M ${a.x1} ${BASE} A ${rx} ${ry} 0 0 1 ${a.x2} ${BASE}`}
                  fill="none"
                  stroke="var(--brass)"
                  strokeWidth="1.5"
                  pathLength={1}
                  className="arc-draw"
                />
              );
            })}
            {unfired.map((n) => (
              <path
                key={n.id}
                d={`M ${n.x} ${BASE} C ${n.x + 2} ${BASE + 9}, ${n.x - 3} ${BASE + 16}, ${n.x + 1} ${BASE + 24}`}
                fill="none"
                stroke="var(--curtain)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ))}
            {layout.nodes.map((n) =>
              n.kind === "setup" ? (
                <circle
                  key={n.id}
                  cx={n.x}
                  cy={BASE}
                  r={3.5}
                  fill={n.state === "unfired" ? "var(--curtain)" : "var(--ink)"}
                  stroke="var(--surface)"
                />
              ) : (
                <path
                  key={n.id}
                  d={`M ${n.x} ${BASE - 3.5} L ${n.x + 3.5} ${BASE} L ${n.x} ${BASE + 3.5} L ${n.x - 3.5} ${BASE} Z`}
                  fill="var(--brass)"
                />
              ),
            )}
          </>
        )}
      </svg>

      <dl className="grid grid-cols-3 gap-2 border-t border-line pt-3">
        {[
          { label: "planted", value: counts?.planted, tone: "" },
          { label: "fired", value: counts?.fired, tone: "text-brass" },
          { label: "never fire", value: counts?.neverFired, tone: "text-curtain" },
        ].map((c) => (
          <div key={c.label} className="flex flex-col">
            <dt className="order-2 mt-1 text-xs text-ink-soft">{c.label}</dt>
            <dd className={`order-1 font-display text-3xl leading-none tabular-nums ${c.tone}`}>
              {c.value ?? "–"}
            </dd>
          </div>
        ))}
      </dl>

      <button
        type="button"
        disabled={!sample}
        onClick={() => sample && onView(sample.result, sample.title)}
        className="min-h-11 rounded-sm border border-ink px-4 text-sm font-medium transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
      >
        See the full report
      </button>
    </figure>
  );
}
