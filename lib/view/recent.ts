import type { AnalysisResult } from "@/lib/types";
import { storyKey } from "@/lib/view/overrides";

/** The writer's last few reports, kept in this browser so they can be reopened. */
export interface RecentReport {
  key: string;
  title: string;
  /** When it was analysed (ms since epoch). */
  at: number;
  words: number;
  result: AnalysisResult;
}

const KEY = "cg-recent";
const MAX = 5;

/** A name for a story: a short first line (its title), else its first chapter's heading. */
export function storyTitle(result: AnalysisResult): string {
  const first = result.chapters[0];
  const line = first?.text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  if (line && line.length <= 60 && !/[.!?,;:"”]$/.test(line)) return line;
  return first?.title || "Untitled story";
}

export function loadRecent(): RecentReport[] {
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(data)) return [];
    return data.filter(
      (r): r is RecentReport =>
        !!r && typeof r.key === "string" && typeof r.title === "string" && typeof r.at === "number" &&
        Array.isArray(r.result?.chapters) && Array.isArray(r.result?.setups),
    );
  } catch {
    return [];
  }
}

/** Remember a report (newest first, one entry per story); older ones give way if storage is full. */
export function saveRecent(result: AnalysisResult, title = storyTitle(result), at = Date.now()): RecentReport[] {
  const key = storyKey(result);
  const words = result.chapters.reduce((n, c) => n + c.text.split(/\s+/).filter(Boolean).length, 0);
  let list = [{ key, title, at, words, result }, ...loadRecent().filter((r) => r.key !== key)].slice(0, MAX);
  while (list.length > 0) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list));
      return list;
    } catch {
      list = list.slice(0, -1);
    }
  }
  return [];
}

export function removeRecent(key: string): RecentReport[] {
  const list = loadRecent().filter((r) => r.key !== key);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: nothing was saved to begin with.
  }
  return list;
}
