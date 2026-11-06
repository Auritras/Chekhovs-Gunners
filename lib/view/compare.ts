import type { AnalysisResult, Setup } from "@/lib/types";
import { storyKey } from "@/lib/view/overrides";

/**
 * Compare drafts: after the writer edits a story and runs it again, what changed?
 * Setup ids are made fresh on every run, so guns are paired across drafts by how alike
 * their quotes and summaries read.
 */
export interface DraftChanges {
  /** Loose in the last draft, firing now. */
  nowFires: Setup[];
  /** Loose now, and new in this draft or firing in the last one. */
  newLoose: Setup[];
  /** Loose in the last draft, and its quoted line is no longer in the story (cut). */
  gone: Setup[];
  /** Loose in both drafts. */
  stillLoose: number;
  /** When the last draft was analysed (ms since epoch). */
  since: number;
}

const DRAFT_KEY = "cg-last-draft";
/** Two runs count as drafts of one story when this share of their vocabulary is shared. */
const SAME_STORY = 0.5;
/** Two guns are the same gun when their quotes or summaries are this alike. */
const SAME_GUN = 0.4;

const words = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}']{3,}/gu) ?? []);

/** Little words that say nothing about which gun a summary describes. */
const STOP = new Set(
  "the and for with that this from into onto his her hers its their they them she him who whom what when where which while than then there here was were are been being has have had can could will would should may might must not but all any some each every very just only also about over under after before again more most other such own same too off out".split(" "),
);
const content = (s: string) => new Set([...words(s)].filter((w) => !STOP.has(w)));

/** How alike two summaries are, as the shared share of the shorter one (needs a few words). */
function overlap(a: Set<string>, b: Set<string>): number {
  if (Math.min(a.size, b.size) < 3) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / Math.min(a.size, b.size);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared);
}

const storyWords = (r: AnalysisResult) => words(r.chapters.map((c) => c.text).join(" "));

/** Is `next` an edited draft of `prev` (and not the very same text, or another story)? */
export function isNewDraft(prev: AnalysisResult, next: AnalysisResult): boolean {
  if (storyKey(prev) === storyKey(next)) return false;
  return jaccard(storyWords(prev), storyWords(next)) >= SAME_STORY;
}

const fires = (r: AnalysisResult, id: string) => r.matches.some((m) => m.setupId === id);
const loose = (r: AnalysisResult, id: string) => r.unfired.includes(id) && !fires(r, id);

/** Where an old quote sits in the new draft, if it is still there word for word. */
function locate(r: AnalysisResult, quote: string): { chapter: number; start: number; end: number } | null {
  const q = quote.trim();
  if (!q) return null;
  for (const c of r.chapters) {
    const at = c.text.indexOf(q);
    if (at >= 0) return { chapter: c.index, start: at, end: at + q.length };
  }
  return null;
}

/**
 * Pair each gun in the new draft with at most one in the old, most alike first. Two guns
 * are the same when the new one is quoted from the very line the old one was, or when
 * their quotes or summaries read alike (a fresh run often words the same gun differently).
 */
function pairGuns(prevResult: AnalysisResult, nextResult: AnalysisResult): Map<string, Setup> {
  const prev = prevResult.setups;
  const next = nextResult.setups;
  const sig = (s: Setup) => ({ q: words(s.quote), s: content(s.summary) });
  const a = prev.map(sig);
  const b = next.map(sig);
  const where = prev.map((s) => locate(nextResult, s.quote));
  const pairs: { i: number; j: number; score: number }[] = [];
  for (let i = 0; i < prev.length; i++) {
    for (let j = 0; j < next.length; j++) {
      const w = where[i];
      const sameLine = w !== null && w.chapter === next[j].chapter && w.start < next[j].end && next[j].start < w.end;
      const score = sameLine ? 1 : Math.max(jaccard(a[i].q, b[j].q), overlap(a[i].s, b[j].s));
      if (score >= SAME_GUN) pairs.push({ i, j, score });
    }
  }
  pairs.sort((x, y) => y.score - x.score);
  const usedOld = new Set<number>();
  const out = new Map<string, Setup>(); // new id -> old setup
  for (const p of pairs) {
    if (usedOld.has(p.i) || out.has(next[p.j].id)) continue;
    usedOld.add(p.i);
    out.set(next[p.j].id, prev[p.i]);
  }
  return out;
}

export function compareDrafts(prev: AnalysisResult, next: AnalysisResult, since: number): DraftChanges {
  const paired = pairGuns(prev, next);
  const pairedOld = new Set([...paired.values()].map((s) => s.id));
  const nowFires: Setup[] = [];
  const newLoose: Setup[] = [];
  let stillLoose = 0;
  for (const s of next.setups) {
    const old = paired.get(s.id);
    const wasLoose = old !== undefined && loose(prev, old.id);
    if (loose(next, s.id)) {
      if (wasLoose) stillLoose++;
      else newLoose.push(s);
    } else if (wasLoose && fires(next, s.id)) {
      nowFires.push(s);
    }
  }
  // Only a line that was really cut counts as gone; a gun this run merely missed is not.
  const gone = prev.setups.filter((s) => !pairedOld.has(s.id) && loose(prev, s.id) && locate(next, s.quote) === null);
  return { nowFires, newLoose, gone, stillLoose, since };
}

/** The last analysed draft of the writer's own story, if any. */
export function loadDraft(): { result: AnalysisResult; at: number } | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { result?: AnalysisResult; at?: number };
    if (!data?.result?.chapters || !Array.isArray(data.result.setups) || typeof data.at !== "number") return null;
    return { result: data.result, at: data.at };
  } catch {
    return null;
  }
}

export function saveDraft(result: AnalysisResult, at = Date.now()): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ result, at }));
  } catch {
    // Storage full or blocked: the next run simply has nothing to compare with.
  }
}

/** On a finished run: compare with the last draft (when this is a new draft of it), then remember this one. */
export function changesSinceLastDraft(result: AnalysisResult): DraftChanges | null {
  const prev = loadDraft();
  const changes = prev && isNewDraft(prev.result, result) ? compareDrafts(prev.result, result, prev.at) : null;
  saveDraft(result);
  return changes;
}
