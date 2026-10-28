import type { AnalysisResult } from "@/lib/types";

export interface ChapterTick {
  chapter: number;
  x: number;
  title: string;
}

export interface ArcNode {
  id: string;
  x: number;
  kind: "setup" | "payoff";
  state: "fired" | "unfired" | "inEnding" | "linked" | "unlinked";
  uncertain: boolean;
}

export interface ArcLine {
  setupId: string;
  payoffId: string;
  x1: number;
  x2: number;
  height: number;
}

export function layoutArcs(
  result: AnalysisResult,
  width: number,
): { chapterTicks: ChapterTick[]; nodes: ArcNode[]; arcs: ArcLine[] } {
  const count = result.chapters.length;
  const band = count > 0 ? width / count : 0;
  const bandStart = (chapterIndex: number): number => {
    const pos = result.chapters.findIndex((c) => c.index === chapterIndex);
    return Math.max(pos, 0) * band;
  };
  const xOf = (chapterIndex: number, start: number): number => {
    const chapter = result.chapters.find((c) => c.index === chapterIndex);
    const base = bandStart(chapterIndex);
    const len = chapter?.text.length ?? 0;
    if (!chapter || len === 0) return base;
    return base + (start / len) * band;
  };

  const chapterTicks = result.chapters.map((c, i) => ({
    chapter: c.index,
    x: i * band,
    title: c.title,
  }));

  const firedSetups = new Set(result.matches.map((m) => m.setupId));
  const linkedPayoffs = new Set(result.matches.map((m) => m.payoffId));
  const uncertain = new Set(result.uncertain);
  const inEnding = new Set(result.inEnding ?? []);
  const setupState = (id: string) =>
    firedSetups.has(id) ? ("fired" as const) : inEnding.has(id) ? ("inEnding" as const) : ("unfired" as const);

  const nodes: ArcNode[] = [
    ...result.setups.map((s) => ({
      id: s.id,
      x: xOf(s.chapter, s.start),
      kind: "setup" as const,
      state: setupState(s.id),
      uncertain: uncertain.has(s.id),
    })),
    ...result.payoffs.map((p) => ({
      id: p.id,
      x: xOf(p.chapter, p.start),
      kind: "payoff" as const,
      state: linkedPayoffs.has(p.id) ? ("linked" as const) : ("unlinked" as const),
      uncertain: uncertain.has(p.id),
    })),
  ];

  const xById = new Map(nodes.map((n) => [n.id, n.x]));
  const arcs: ArcLine[] = [];
  for (const m of result.matches) {
    const x1 = xById.get(m.setupId);
    const x2 = xById.get(m.payoffId);
    if (x1 === undefined || x2 === undefined) continue;
    arcs.push({ setupId: m.setupId, payoffId: m.payoffId, x1, x2, height: (x2 - x1) / 2 });
  }

  return { chapterTicks, nodes, arcs };
}
