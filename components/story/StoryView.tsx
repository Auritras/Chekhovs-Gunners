"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isTypingOrBusy } from "@/lib/view/keys";
import GunGlyph from "@/components/effects/GunGlyph";
import type { AnalysisResult } from "@/lib/types";
import { highlightSegments, type HighlightMark } from "@/lib/view/highlight";
import { payoffPassage, type Overrides } from "@/lib/view/overrides";

export const markElementId = (id: string) => `mark-${id}`;

type Info = { kind: "setup" | "payoff"; state: string; uncertain: boolean; summary: string };

/** Which style wins where marks overlap: problems first. */
function rank(i: Info): number {
  if (i.kind === "setup" && i.state === "unfired" && !i.uncertain) return 0;
  if (i.uncertain) return 1;
  if (i.kind === "setup") return 2;
  return 3;
}

function markClass(i: Info): string {
  if (i.uncertain) return "mark mark-uncertain";
  return `mark mark-${i.kind}-${i.state}`;
}

export default function StoryView({
  result,
  overrides = {},
  target,
  onBack,
  pick = null,
  onPicked,
  onCancelPick,
  onAddGun,
  onSelect,
}: {
  result: AnalysisResult;
  overrides?: Overrides;
  target: { id: string; seq: number } | null;
  /** Return to the report card the writer came from. */
  onBack?: () => void;
  /** Pick mode: the writer selects the passage where this gun fires. */
  /** "payoff": where a gun the writer marked fires; "setup": a line planting a gun the tool missed. */
  pick?: { mode: "payoff"; setupId: string; chapter: number; summary: string } | { mode: "setup" } | null;
  onPicked?: (chapter: number, passage: { start: number; end: number; quote: string }, name?: string) => void;
  onCancelPick?: () => void;
  onAddGun?: () => void;
  /** Spotlight a setup (from the margin guns or J / K). */
  onSelect?: (setupId: string) => void;
}) {
  const articleRef = useRef<HTMLElement>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [gunName, setGunName] = useState("");

  /** Read the writer's text selection as offsets into one chapter's text. */
  function applyPickedLine() {
    if (!pick) return;
    const sel = window.getSelection();
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    const box = (n: Node | null) =>
      (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>("[data-chapter]") ?? null;
    const container = range ? box(range.startContainer) : null;
    if (!range || range.collapsed || !container || container !== box(range.endContainer)) {
      setPickError("Select a few words inside one chapter first.");
      return;
    }
    const before = document.createRange();
    before.setStart(container, 0);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    const chapter = Number(container.dataset.chapter);
    const text = result.chapters.find((c) => c.index === chapter)?.text ?? "";
    // A new gun can be planted anywhere; a payoff must come after its setup.
    const setup =
      pick.mode === "payoff" ? result.setups.find((x) => x.id === pick.setupId) : { chapter: 0, end: 0 };
    if (!setup) return;
    const passage = payoffPassage(text, start, start + range.toString().length, setup, chapter);
    if ("error" in passage) {
      setPickError(passage.error);
      return;
    }
    setPickError(null);
    sel?.removeAllRanges();
    onPicked?.(chapter, passage, gunName);
    setGunName("");
  }

  // The jump (by seq) the writer dismissed; while a newer one is live, other highlights fade.
  const [dismissed, setDismissed] = useState<number | null>(null);
  const focusId = target && target.seq !== dismissed ? target.id : null;

  const { info, marksByChapter } = useMemo(() => {
    const fired = new Set(result.matches.map((m) => m.setupId));
    const linked = new Set(result.matches.map((m) => m.payoffId));
    const uncertain = new Set(result.uncertain);
    const inEnding = new Set(result.inEnding ?? []);
    const info = new Map<string, Info>();
    const marksByChapter = new Map<number, HighlightMark[]>();
    const add = (chapter: number, m: HighlightMark, summary: string) => {
      info.set(m.id, { kind: m.kind, state: m.state, uncertain: uncertain.has(m.id), summary });
      const list = marksByChapter.get(chapter) ?? [];
      list.push(m);
      marksByChapter.set(chapter, list);
    };
    for (const s of result.setups) {
      const call = fired.has(s.id) ? undefined : overrides[s.id];
      // The writer's calls: gold for "it does fire", muted like an ending detail for "not a gun".
      const state = fired.has(s.id)
        ? "fired"
        : call?.kind === "fired"
          ? "writer"
          : call?.kind === "dismissed" || inEnding.has(s.id)
            ? "inEnding"
            : "unfired";
      add(s.chapter, { id: s.id, start: s.start, end: s.end, kind: "setup", state }, s.summary);
    }
    // Passages the writer pointed to as payoffs: gold.
    for (const [id, call] of Object.entries(overrides)) {
      if (call.kind !== "fired" || call.start === undefined || call.end === undefined) continue;
      const setup = result.setups.find((x) => x.id === id);
      add(
        call.chapter,
        { id: `writer-${id}`, start: call.start, end: call.end, kind: "payoff", state: "writer" },
        `Pays off: ${setup?.summary ?? "a setup"} (marked by you)`,
      );
    }
    for (const p of result.payoffs) {
      const state = linked.has(p.id) ? "linked" : "unlinked";
      add(p.chapter, { id: p.id, start: p.start, end: p.end, kind: "payoff", state }, p.summary);
    }
    return { info, marksByChapter };
  }, [result, overrides]);

  useEffect(() => {
    if (!target) return;
    const el = document.getElementById(markElementId(target.id));
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // "start" plus the mark's scroll margin lands it just under the sticky tabs.
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
    el.classList.remove("mark-flash");
    void el.offsetWidth; // restart the flash on repeat visits
    el.classList.add("mark-flash");
  }, [target]);

  /** Clicking any other highlight brings the rest back. */
  function onClick(e: React.MouseEvent) {
    if (!focusId || !target) return;
    const mark = (e.target as HTMLElement).closest("mark");
    if (mark && !mark.classList.contains("mark-target")) setDismissed(target.seq);
  }

  const hasUncertain = result.uncertain.length > 0;

  // The loose ends, in story order: what J / K walk through.
  const loose = useMemo(
    () =>
      result.setups
        .filter((s) => result.unfired.includes(s.id) && !overrides[s.id])
        .sort((a, b) => a.chapter - b.chapter || a.start - b.start)
        .map((s) => s.id),
    [result, overrides],
  );
  useEffect(() => {
    if (!onSelect || loose.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      // Typing in a field (the gun name, a search box) is not navigation.
      if (isTypingOrBusy(e)) return;
      const key = e.key.toLowerCase();
      if (key !== "j" && key !== "k") return;
      e.preventDefault();
      const at = target ? loose.indexOf(target.id) : -1;
      const next =
        key === "j"
          ? loose[at < 0 ? 0 : (at + 1) % loose.length]
          : loose[at < 0 ? loose.length - 1 : (at - 1 + loose.length) % loose.length];
      onSelect(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSelect, loose, target]);

  // Guns in the margin: one per setup, beside the line that plants it, coloured by its fate.
  const [pins, setPins] = useState<{ id: string; chapter: number; top: number; state: string; summary: string }[]>([]);
  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const measure = () => {
      const next: typeof pins = [];
      for (const s of result.setups) {
        const mark = document.getElementById(markElementId(s.id));
        const section = mark?.closest("section");
        if (!mark || !section) continue;
        const top = mark.getBoundingClientRect().top - section.getBoundingClientRect().top;
        const state = info.get(s.id)?.uncertain ? "uncertain" : (info.get(s.id)?.state ?? "unfired");
        next.push({ id: s.id, chapter: s.chapter, top, state, summary: s.summary });
      }
      // Guns planted on the same line stack downwards instead of overlapping.
      next.sort((a, b) => a.chapter - b.chapter || a.top - b.top);
      for (let i = 1; i < next.length; i++) {
        const prev = next[i - 1];
        if (prev.chapter === next[i].chapter && next[i].top < prev.top + 16) next[i].top = prev.top + 16;
      }
      setPins(next);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(article);
    return () => ro.disconnect();
  }, [result, info]);

  return (
    <article ref={articleRef} className={`flex flex-col gap-10 ${focusId ? "story-focus" : ""}`} onClick={onClick}>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft" aria-label="Key">
        <li><span className="mark mark-setup-fired">Setup that fires</span></li>
        <li><span className="mark mark-setup-unfired">Setup that never fires</span></li>
        <li><span className="mark mark-payoff-linked">Payoff</span></li>
        <li><span className="mark mark-payoff-unlinked">Payoff with no setup</span></li>
        {Object.values(overrides).some((o) => o.kind === "fired") && (
          <li><span className="mark mark-setup-writer">Fires, marked by you</span></li>
        )}
        {(result.inEnding?.length ?? 0) > 0 && (
          <li><span className="mark mark-setup-inEnding">Setup in the ending</span></li>
        )}
        {hasUncertain && <li><span className="mark mark-uncertain">Uncertain</span></li>}
        {onSelect && loose.length > 0 && (
          <li className="text-muted">
            <kbd className="rounded-sm border border-line px-1 font-sans text-xs">J</kbd> /{" "}
            <kbd className="rounded-sm border border-line px-1 font-sans text-xs">K</kbd> next or previous loose end
          </li>
        )}
        {onAddGun && !pick && (
          <li>
            <button
              type="button"
              onClick={onAddGun}
              className="text-ink-soft underline decoration-line underline-offset-4 hover:text-ink hover:decoration-current"
            >
              + Add a gun the tool missed
            </button>
          </li>
        )}
      </ul>

      {pick && (
        <div
          role="region"
          aria-label="Point to the line"
          className="sticky top-[calc(3.5rem+1px)] z-[6] -mx-4 flex flex-col gap-2 border-b-2 border-gold bg-paper px-4 py-2 sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:px-0"
        >
          <div className="flex min-w-0 flex-col gap-2 text-sm">
            {pick.mode === "payoff" ? (
              <p>
                Select the line where <span className="font-medium">“{pick.summary}”</span> pays off, then press{" "}
                <em>Use this line</em>.
              </p>
            ) : (
              <>
                <p>
                  Select the line that plants the gun, then press <em>Use this line</em>.
                </p>
                <label className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-soft">What is it? (optional)</span>
                  <input
                    id="writer-gun-name"
                    value={gunName}
                    onChange={(e) => setGunName(e.target.value)}
                    placeholder="e.g. the brass bell over the door"
                    className="min-h-11 min-w-0 flex-1 rounded-sm border border-line bg-surface px-3 text-ink placeholder:text-muted focus:border-ink focus:outline-none"
                  />
                </label>
              </>
            )}
            {pickError && <span className="block text-curtain">{pickError}</span>}
          </div>
          <span className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={applyPickedLine}
              className="min-h-11 rounded-sm bg-gold px-4 text-sm font-medium text-paper transition-opacity hover:opacity-90"
            >
              Use this line
            </button>
            <button
              type="button"
              onClick={() => {
                setPickError(null);
                onCancelPick?.();
              }}
              className="min-h-11 rounded-sm border border-line px-4 text-sm font-medium text-ink-soft hover:border-ink hover:text-ink"
            >
              Cancel
            </button>
          </span>
        </div>
      )}

      {/* A strip attached under the tabs: the story scrolls beneath it instead of being covered. */}
      {!pick && (onBack || (focusId && target)) && (
        <div className="sticky top-[calc(3.5rem+1px)] z-[5] -mx-4 flex flex-wrap items-center justify-between gap-x-6 border-b border-line bg-paper px-4 sm:mx-0 sm:px-0">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="min-h-11 text-sm font-medium text-brass transition-colors hover:text-ink"
            >
              ← Back to report
            </button>
          ) : (
            <span />
          )}
          {focusId && target && (
            <button
              type="button"
              onClick={() => setDismissed(target.seq)}
              className="min-h-11 text-sm text-ink-soft underline decoration-line underline-offset-4 transition-colors hover:text-ink hover:decoration-current"
            >
              Show all highlights
            </button>
          )}
        </div>
      )}

      {result.chapters.map((c) => {
        const segments = highlightSegments(c.text, marksByChapter.get(c.index) ?? []);
        const seen = new Set<string>();
        const failed = result.failedChapters.includes(c.index);
        return (
          <section
            key={c.index}
            aria-labelledby={`story-ch-${c.index}`}
            className="relative max-w-[calc(68ch+2.5rem)] pl-10"
          >
            {/* Margin guns: red never fires, brass fires, gold marked by you, grey set aside or uncertain. */}
            {pins
              .filter((p) => p.chapter === c.index)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.summary}
                  aria-label={`Spotlight: ${p.summary}`}
                  onClick={() => onSelect?.(p.id)}
                  className={`absolute left-0 flex h-6 w-8 items-center justify-center rounded-sm transition-opacity hover:opacity-70 ${
                    p.state === "unfired"
                      ? "text-curtain"
                      : p.state === "fired"
                        ? "text-brass"
                        : p.state === "writer"
                          ? "text-gold"
                          : "text-muted"
                  }`}
                  style={{ top: p.top }}
                >
                  <GunGlyph className="h-3 w-6" />
                </button>
              ))}
            <h3 id={`story-ch-${c.index}`} className="font-display text-3xl">
              {c.title || `Chapter ${c.index}`}
            </h3>
            {failed && (
              <p className="mt-1 text-sm italic text-muted">This chapter couldn&apos;t be analysed.</p>
            )}
            <div data-chapter={c.index} className="mt-4 whitespace-pre-wrap font-serif text-[1.075rem] leading-[1.8]">
              {segments.map((seg, i) => {
                if (seg.marks.length === 0) return <span key={i}>{seg.text}</span>;
                const infos = seg.marks
                  .map((id) => ({ id, i: info.get(id) }))
                  .filter((x): x is { id: string; i: Info } => !!x.i);
                const top = infos.sort((a, b) => rank(a.i) - rank(b.i))[0];
                // The first segment of each mark carries its anchor id.
                const anchor = seg.marks.find((id) => !seen.has(id));
                seg.marks.forEach((id) => seen.add(id));
                const isTarget = focusId !== null && seg.marks.includes(focusId);
                return (
                  <mark
                    key={i}
                    id={anchor ? markElementId(anchor) : undefined}
                    tabIndex={anchor ? -1 : undefined}
                    className={`${top ? markClass(top.i) : "mark"}${isTarget ? " mark-target" : ""}`}
                    title={infos.map((x) => x.i.summary).join("\n")}
                  >
                    {seg.text}
                  </mark>
                );
              })}
            </div>
          </section>
        );
      })}
    </article>
  );
}
