"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AnalysisResult, Payoff, Setup } from "@/lib/types";
import { layoutArcs, type ArcNode } from "@/lib/view/arcLayout";
import type { Override, Overrides } from "@/lib/view/overrides";

const PAD_X = 14;
const TOP = 14;
const DANGLE_ZONE = 44;
const LABEL_ZONE = 26;
const STAGGER_MS = 70;
/** Id prefix for the payoff marker at the end of a gun the writer marked as firing. */
const PAY = "writer-pay:";
const MAX_STAGGER_MS = 1800;
const DRAW_MS = 900;

function nodeLabel(
  node: ArcNode,
  item: Setup | Payoff | undefined,
  chapterTitle: string,
  call: Override | undefined,
): string {
  const what = node.kind === "setup" ? "Setup" : "Payoff";
  const state = call
    ? call.kind === "fired"
      ? "fires, marked by you"
      : "set aside by you"
    : node.uncertain
    ? "uncertain"
    : {
        fired: "fired",
        unfired: "never fired",
        inEnding: "in the ending, too late to pay off",
        linked: "pays off a setup",
        unlinked: "no setup found",
      }[node.state];
  return `${what} in ${chapterTitle}, ${state}: ${item?.summary ?? ""}`;
}

/**
 * A gun the writer marked as firing: a gold arc. When the call was just made, the red
 * thread hanging under the gun pulls up into the arc instead of being swapped for it.
 */
function WriterArc({
  x1,
  x2,
  base,
  ry,
  threadLen,
  fromThread,
  dim,
}: {
  x1: number;
  x2: number;
  base: number;
  ry: number;
  threadLen: number;
  fromThread: boolean;
  dim: boolean;
}) {
  const ref = useRef<SVGPathElement>(null);
  const played = useRef(false);
  // Both shapes as one cubic curve, so the browser can morph one into the other.
  const k = (ry * 4) / 3;
  const arc = `M ${x1} ${base} C ${x1} ${base - k}, ${x2} ${base - k}, ${x2} ${base}`;
  const thread = `M ${x1} ${base} C ${x1 + 2} ${base + threadLen * 0.4}, ${x1 - 3} ${base + threadLen * 0.7}, ${x1 + 1} ${base + threadLen}`;

  useEffect(() => {
    const el = ref.current;
    if (!fromThread || played.current || !el) return;
    played.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const anim = el.animate(
      [
        { d: `path("${thread}")`, stroke: "var(--curtain)" },
        { d: `path("${arc}")`, stroke: "var(--gold)" },
      ],
      { duration: 1100, easing: "cubic-bezier(0.3, 1.25, 0.5, 1)" },
    );
    return () => anim.cancel();
  }, [fromThread, thread, arc]);

  return (
    <path
      ref={ref}
      d={arc}
      pathLength={fromThread ? undefined : 1}
      fill="none"
      stroke="var(--gold)"
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeOpacity={dim ? 0.18 : 1}
      className={fromThread ? "writer-arc-pulled" : "writer-arc"}
    />
  );
}

export default function ArcMap({
  result,
  overrides = {},
}: {
  result: AnalysisResult;
  overrides?: Overrides;
}) {
  const uid = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [active, setActive] = useState<string | null>(null);
  // Guns already marked as firing when the map appeared draw in normally; ones marked
  // while it is on screen pull up from their red thread.
  const [firedAtMount] = useState(
    () => new Set(Object.entries(overrides).filter(([, o]) => o.kind === "fired").map(([id]) => id)),
  );

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(280, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, Setup | Payoff>();
    for (const s of result.setups) m.set(s.id, s);
    for (const p of result.payoffs) m.set(p.id, p);
    return m;
  }, [result]);
  const setupById = useMemo(() => new Map(result.setups.map((s) => [s.id, s])), [result]);
  const chapterTitle = (n: number) =>
    result.chapters.find((c) => c.index === n)?.title || `Chapter ${n}`;

  const plotW = (width ?? 0) - PAD_X * 2;
  const layout = useMemo(() => (width ? layoutArcs(result, plotW) : null), [result, width, plotW]);
  const maxArc = Math.round(Math.min(240, Math.max(120, plotW * 0.3)));
  const base = TOP + maxArc;
  const height = base + DANGLE_ZONE + LABEL_ZONE;
  const band = result.chapters.length ? plotW / result.chapters.length : plotW;

  const related = useMemo(() => {
    if (!active) return null;
    const ids = new Set([active]);
    for (const m of result.matches) {
      if (m.setupId === active) ids.add(m.payoffId);
      if (m.payoffId === active) ids.add(m.setupId);
    }
    // A writer's call links the gun to its payoff marker, and back.
    if (active.startsWith(PAY)) ids.add(active.slice(PAY.length));
    else if (overrides[active]?.kind === "fired") ids.add(PAY + active);
    return ids;
  }, [active, result.matches, overrides]);

  // With nothing under the pointer, show the first gun that never fires (else the first setup),
  // so the surtitle is never an empty band and touch screens see a line without hovering.
  const restingId = useMemo(() => {
    const unfired = new Set(result.unfired.filter((id) => !overrides[id]));
    const first = [...result.setups]
      .sort((a, b) => a.chapter - b.chapter || a.start - b.start)
      .sort((a, b) => Number(unfired.has(b.id)) - Number(unfired.has(a.id)))[0];
    return first?.id ?? null;
  }, [result, overrides]);
  const shown = active ?? restingId;
  const activeItem = shown ? byId.get(shown) : undefined;
  const activeNode = shown ? layout?.nodes.find((n) => n.id === shown) : undefined;
  const uncertain = new Set(result.uncertain);
  const failed = new Set(result.failedChapters);

  const arcs = layout
    ? [...layout.arcs].sort((a, b) => a.x1 - b.x1 || a.x2 - b.x2)
    : [];
  const stagger = arcs.length > 1 ? Math.min(STAGGER_MS, MAX_STAGGER_MS / (arcs.length - 1)) : 0;
  const dangleDelay = (arcs.length ? stagger * (arcs.length - 1) + DRAW_MS * 0.7 : 0) + 100;

  const unfiredNodes =
    layout?.nodes.filter((n) => n.kind === "setup" && n.state === "unfired" && !overrides[n.id]) ?? [];
  const activeCall = shown ? overrides[shown] : undefined;

  // Gold arcs for the guns the writer marked as firing: setup to the middle of the chapter they picked.
  const writerArcs = layout
    ? Object.entries(overrides).flatMap(([id, call]) => {
        if (call.kind !== "fired") return [];
        const node = layout.nodes.find((n) => n.id === id);
        const tick = layout.chapterTicks.find((t) => t.chapter === call.chapter);
        if (!node || !tick) return [];
        // At the passage the writer pointed to, else the middle of the chapter they picked.
        const len = result.chapters.find((c) => c.index === call.chapter)?.text.length ?? 0;
        let x2 = call.start !== undefined && len > 0 ? tick.x + (call.start / len) * band : tick.x + band / 2;
        if (x2 <= node.x + 6) x2 = Math.min(node.x + Math.max(14, band * 0.3), plotW);
        return [{ id, x1: node.x, x2, chapter: call.chapter, quote: call.quote }];
      })
    : [];

  return (
    <section id="arc-map" aria-labelledby={`${uid}-h`} className="flex scroll-mt-24 flex-col gap-4">
      <div>
        <h2 id={`${uid}-h`} className="font-display text-3xl">
          Arc map
        </h2>
        <p className="mt-1 max-w-[62ch] text-sm text-ink-soft">
          Each arc runs from a setup to the moment it pays off. Red threads hang from the guns that
          never fire. Hover, tap or tab to any mark to read its line.
        </p>
      </div>

      {/* Surtitle: the line behind whichever mark is under the pointer or focus.
          Fixed height so the chart below never moves when the text changes; a moving
          chart slid marks out from under a still pointer and made hover flicker. */}
      <div aria-live="polite" className="h-[10.5rem] overflow-hidden border-y border-line py-3 sm:h-[9rem]">
        {shown?.startsWith(PAY) ? (
          (() => {
            const pay = writerArcs.find((a) => PAY + a.id === shown);
            const gun = byId.get(shown.slice(PAY.length));
            if (!pay) return null;
            return (
              <>
                <p className="truncate text-sm text-ink-soft">
                  Payoff in {chapterTitle(pay.chapter)}
                  <span className="text-gold">, marked by you</span>
                </p>
                {pay.quote ? (
                  <blockquote title={pay.quote} className="mt-1 line-clamp-3 font-serif text-lg italic leading-snug">
                    “{pay.quote}”
                  </blockquote>
                ) : (
                  <p className="mt-1 font-serif text-lg italic leading-snug text-muted">
                    You marked the chapter. Use “Point to the line” in Guns that fired to quote the sentence.
                  </p>
                )}
                <p className="mt-1 truncate text-sm text-ink-soft">Pays off: {gun?.summary}</p>
              </>
            );
          })()
        ) : activeItem && activeNode ? (
          <>
            <p className="truncate text-sm text-ink-soft">
              {activeNode.kind === "setup" ? "Setup" : "Payoff"} in {chapterTitle(activeItem.chapter)}
              {activeCall?.kind === "fired" && (
                <span className="text-gold">, fires in {chapterTitle(activeCall.chapter)} (marked by you)</span>
              )}
              {activeCall?.kind === "dismissed" && <span>, set aside by you</span>}
              {!activeCall && activeNode.state === "unfired" && !activeNode.uncertain && (
                <span className="text-curtain">, never fires</span>
              )}
              {activeNode.uncertain && ", may be affected by a failed chapter"}
              {activeNode.state === "inEnding" && ", in the ending, too late to pay off"}
            </p>
            <blockquote
              title={activeItem.quote}
              className="mt-1 line-clamp-3 font-serif text-lg italic leading-snug"
            >
              “{activeItem.quote}”
            </blockquote>
            <p className="mt-1 truncate text-sm text-ink-soft">{activeItem.summary}</p>
          </>
        ) : (
          <p className="pt-2 font-serif italic text-muted">No setups were found in this story.</p>
        )}
      </div>

      <div ref={boxRef} className="w-full">
        {layout && width && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block overflow-visible"
            role="group"
            aria-label="Arc map of setups and payoffs"
          >
            <defs>
              <pattern
                id={`${uid}-hatch`}
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" strokeWidth="1" opacity="0.35" />
              </pattern>
            </defs>

            <g transform={`translate(${PAD_X} 0)`}>
              {/* Chapter bands */}
              {layout.chapterTicks.map((t, i) => (
                <g key={t.chapter}>
                  <title>{t.title}</title>
                  {failed.has(t.chapter) ? (
                    <rect x={t.x} y={TOP} width={band} height={base - TOP + DANGLE_ZONE} fill={`url(#${uid}-hatch)`} />
                  ) : (
                    i % 2 === 1 && (
                      <rect x={t.x} y={TOP} width={band} height={base - TOP + DANGLE_ZONE} fill="var(--ink)" opacity="0.03" />
                    )
                  )}
                  <line x1={t.x} x2={t.x} y1={TOP} y2={base + DANGLE_ZONE} stroke="var(--line)" strokeWidth="1" />
                  <text
                    x={t.x + band / 2}
                    y={base + DANGLE_ZONE + 18}
                    textAnchor="middle"
                    className="font-sans tabular-nums"
                    fontSize="12"
                    fill={failed.has(t.chapter) ? "var(--muted)" : "var(--ink-soft)"}
                  >
                    {t.chapter}
                  </text>
                </g>
              ))}
              <line x1={plotW} x2={plotW} y1={TOP} y2={base + DANGLE_ZONE} stroke="var(--line)" strokeWidth="1" />

              {/* Stage floor */}
              <line x1={0} x2={plotW} y1={base} y2={base} stroke="var(--ink)" strokeWidth="1.25" />

              {/* Arcs */}
              {arcs.map((a, i) => {
                const dx = a.x2 - a.x1;
                const rx = Math.max(Math.abs(dx) / 2, 3);
                const ry = Math.min(Math.max(Math.abs(a.height), 6) * 0.85, maxArc - 6);
                const sweep = dx >= 0 ? 1 : 0;
                const x2 = Math.abs(dx) < 6 ? a.x1 + (dx >= 0 ? 6 : -6) : a.x2;
                const d = `M ${a.x1} ${base} A ${rx} ${ry} 0 0 ${sweep} ${x2} ${base}`;
                const shaky = uncertain.has(a.setupId) || uncertain.has(a.payoffId);
                const importance = setupById.get(a.setupId)?.importance ?? 2;
                const dim = related && !(related.has(a.setupId) && related.has(a.payoffId));
                return (
                  <path
                    key={`${a.setupId}-${a.payoffId}`}
                    d={d}
                    pathLength={shaky ? undefined : 1}
                    fill="none"
                    stroke={shaky ? "var(--muted)" : "var(--brass)"}
                    strokeWidth={0.75 + importance * 0.6}
                    strokeDasharray={shaky ? "4 4" : undefined}
                    strokeLinecap="round"
                    strokeOpacity={dim ? 0.18 : 1}
                    className={shaky ? "arc-fade" : "arc-draw"}
                    style={{
                      animationDelay: `${Math.round(i * stagger)}ms`,
                    }}
                  />
                );
              })}

              {/* The writer's calls: gold arcs, drawn after the tool's own */}
              {writerArcs.map((a) => {
                const rx = Math.max((a.x2 - a.x1) / 2, 3);
                const ry = Math.min(Math.max(rx * 0.9, 10), maxArc - 6);
                return (
                  <WriterArc
                    key={`writer-${a.id}`}
                    x1={a.x1}
                    x2={a.x2}
                    base={base}
                    ry={ry}
                    threadLen={12 + (setupById.get(a.id)?.importance ?? 1) * 9}
                    fromThread={!firedAtMount.has(a.id)}
                    dim={!!related && !related.has(a.id)}
                  />
                );
              })}

              {/* Dangling threads under guns that never fire */}
              {unfiredNodes.map((n) => {
                const len = 12 + (setupById.get(n.id)?.importance ?? 1) * 9;
                const d = `M ${n.x} ${base} C ${n.x + 2} ${base + len * 0.4}, ${n.x - 3} ${base + len * 0.7}, ${n.x + 1} ${base + len}`;
                const dim = related && !related.has(n.id);
                return (
                  <path
                    key={`dangle-${n.id}`}
                    d={d}
                    pathLength={n.uncertain ? undefined : 1}
                    fill="none"
                    stroke={n.uncertain ? "var(--muted)" : "var(--curtain)"}
                    strokeWidth="2"
                    strokeDasharray={n.uncertain ? "3 3" : undefined}
                    strokeLinecap="round"
                    strokeOpacity={dim ? 0.18 : 1}
                    className={n.uncertain ? "arc-fade" : "arc-draw"}
                    style={{
                      animationDelay: `${Math.round(dangleDelay)}ms`,
                      animationDuration: "500ms",
                    }}
                  />
                );
              })}

              {/* Nodes */}
              {layout.nodes.map((n) => {
                const item = byId.get(n.id);
                const isActive = shown === n.id;
                const dim = related && !related.has(n.id);
                const call = overrides[n.id];
                const label = nodeLabel(n, item, chapterTitle(item?.chapter ?? 0), call);
                let mark: React.ReactNode;
                if (n.kind === "setup") {
                  const ending = (n.state === "inEnding" && !n.uncertain) || call?.kind === "dismissed";
                  const fill =
                    call?.kind === "fired"
                      ? "var(--gold)"
                      : n.uncertain || ending
                        ? "var(--paper)"
                        : n.state === "unfired"
                          ? "var(--curtain)"
                          : "var(--ink)";
                  mark = (
                    <circle
                      cx={n.x}
                      cy={base}
                      r={isActive ? 6.5 : 4.5}
                      fill={fill}
                      stroke={n.uncertain || ending ? "var(--muted)" : "var(--paper)"}
                      strokeWidth={n.uncertain ? 1.5 : 1.25}
                      strokeDasharray={n.uncertain ? "2 2" : undefined}
                    />
                  );
                } else {
                  const s = isActive ? 6.5 : 4.5;
                  const linked = n.state === "linked" && !n.uncertain;
                  mark = (
                    <path
                      d={`M ${n.x} ${base - s} L ${n.x + s} ${base} L ${n.x} ${base + s} L ${n.x - s} ${base} Z`}
                      fill={linked ? "var(--brass)" : "var(--paper)"}
                      stroke={n.uncertain ? "var(--muted)" : linked ? "var(--paper)" : "var(--ink-soft)"}
                      strokeWidth="1.25"
                      strokeDasharray={n.uncertain ? "2 2" : undefined}
                    />
                  );
                }
                return (
                  <g
                    key={n.id}
                    tabIndex={0}
                    role="button"
                    aria-label={label}
                    aria-pressed={active === n.id}
                    className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-[var(--focus)]"
                    style={{ opacity: dim ? 0.3 : 1, transition: "opacity 160ms" }}
                    onMouseEnter={() => setActive(n.id)}
                    onMouseLeave={() => setActive((cur) => (cur === n.id ? null : cur))}
                    onFocus={() => setActive(n.id)}
                    onBlur={() => setActive((cur) => (cur === n.id ? null : cur))}
                    onClick={() => setActive(n.id)}
                  >
                    {/* Generous invisible hit area for pointers and the focus ring. */}
                    <circle cx={n.x} cy={base} r={11} fill="transparent" strokeWidth="2" />
                    {mark}
                  </g>
                );
              })}
              {/* Payoff markers at the end of the writer's gold arcs: hover to read the chosen line. */}
              {writerArcs.map((a) => {
                const pid = PAY + a.id;
                const isActive = shown === pid;
                const s = isActive ? 6.5 : 4.5;
                const dim = related && !related.has(pid);
                return (
                  <g
                    key={pid}
                    tabIndex={0}
                    role="button"
                    aria-label={`Payoff in ${chapterTitle(a.chapter)}, marked by you${a.quote ? `: ${a.quote}` : ""}`}
                    aria-pressed={active === pid}
                    className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-[var(--focus)]"
                    style={{ opacity: dim ? 0.3 : 1, transition: "opacity 160ms" }}
                    onMouseEnter={() => setActive(pid)}
                    onMouseLeave={() => setActive((cur) => (cur === pid ? null : cur))}
                    onFocus={() => setActive(pid)}
                    onBlur={() => setActive((cur) => (cur === pid ? null : cur))}
                    onClick={() => setActive(pid)}
                  >
                    <circle cx={a.x2} cy={base} r={11} fill="transparent" strokeWidth="2" />
                    <path
                      d={`M ${a.x2} ${base - s} L ${a.x2 + s} ${base} L ${a.x2} ${base + s} L ${a.x2 - s} ${base} Z`}
                      fill="var(--gold)"
                      stroke="var(--paper)"
                      strokeWidth="1.25"
                    />
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>

      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft" aria-label="Legend">
        <li className="flex items-center gap-2">
          <svg width="14" height="14" aria-hidden><circle cx="7" cy="7" r="4.5" fill="var(--ink)" /></svg>
          Setup
        </li>
        <li className="flex items-center gap-2">
          <svg width="14" height="14" aria-hidden><path d="M7 2.5 L11.5 7 L7 11.5 L2.5 7 Z" fill="var(--brass)" /></svg>
          Payoff
        </li>
        <li className="flex items-center gap-2">
          <svg width="26" height="14" aria-hidden><path d="M2 12 A 11 9 0 0 1 24 12" fill="none" stroke="var(--brass)" strokeWidth="2" /></svg>
          Fired
        </li>
        <li className="flex items-center gap-2">
          <svg width="14" height="18" aria-hidden><circle cx="7" cy="4.5" r="4" fill="var(--curtain)" /><path d="M7 5 L7 17" stroke="var(--curtain)" strokeWidth="2" strokeLinecap="round" /></svg>
          Never fired
        </li>
        {writerArcs.length > 0 && (
          <li className="flex items-center gap-2">
            <svg width="26" height="14" aria-hidden><path d="M2 12 A 11 9 0 0 1 24 12" fill="none" stroke="var(--gold)" strokeWidth="2.75" /></svg>
            Fires, marked by you
          </li>
        )}
        {(result.inEnding?.length ?? 0) > 0 && (
          <li className="flex items-center gap-2">
            <svg width="14" height="14" aria-hidden><circle cx="7" cy="7" r="4.5" fill="var(--paper)" stroke="var(--muted)" strokeWidth="1.5" /></svg>
            In the ending, too late to pay off
          </li>
        )}
        {result.uncertain.length > 0 && (
          <li className="flex items-center gap-2">
            <svg width="26" height="14" aria-hidden><path d="M2 7 L24 7" stroke="var(--muted)" strokeWidth="2" strokeDasharray="3 3" /></svg>
            Uncertain
          </li>
        )}
        {result.failedChapters.length > 0 && (
          <li className="flex items-center gap-2">
            <svg width="16" height="14" aria-hidden><rect width="16" height="14" fill={`url(#${uid}-hatch)`} stroke="var(--line)" /></svg>
            Failed chapter
          </li>
        )}
      </ul>
    </section>
  );
}
