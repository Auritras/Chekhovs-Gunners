import type { AnalysisResult } from "@/lib/types";

/**
 * The writer's call on a gun the tool says never fires: it does fire (in a chapter they
 * pick), or it is not a gun at all (set aside). The tool's own verdict is never changed;
 * views show both.
 */
export type Override = { kind: "fired"; chapter: number } | { kind: "dismissed" };
export type Overrides = Record<string, Override>;

/** A short stable id for a story, so a writer's calls are remembered per story. */
export function storyKey(result: AnalysisResult): string {
  let h = 0x811c9dc5;
  for (const c of result.chapters) {
    const s = `${c.title}\n${c.text}\n`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return (h >>> 0).toString(36);
}

const storageKey = (key: string) => `cg-overrides-${key}`;

/** The writer's saved calls for this story; {} if none or storage is unavailable. */
export function loadOverrides(key: string): Overrides {
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    const data: unknown = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? (data as Overrides) : {};
  } catch {
    return {};
  }
}

export function saveOverrides(key: string, overrides: Overrides): void {
  try {
    if (Object.keys(overrides).length === 0) window.localStorage.removeItem(storageKey(key));
    else window.localStorage.setItem(storageKey(key), JSON.stringify(overrides));
  } catch {
    // Private mode or blocked storage: the calls still apply until the page closes.
  }
}

/** Only guns the tool left unfired can be overridden; anything else in storage is ignored. */
export function activeOverrides(result: AnalysisResult, overrides: Overrides): Overrides {
  const open = new Set([...result.unfired, ...result.uncertain]);
  const fired = new Set(result.matches.map((m) => m.setupId));
  return Object.fromEntries(
    Object.entries(overrides).filter(([id]) => open.has(id) && !fired.has(id)),
  );
}
