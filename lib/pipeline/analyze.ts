import type { AnalysisResult, Chapter, Match, Payoff, Setup } from "@/lib/types";
import {
  RawExtraction,
  RawMatches,
  type ExtractRequest,
  type MatchRequest,
} from "@/lib/ai/schemas";
import { extractCacheKey, matchCacheKey, type CacheStore } from "@/lib/cache";
import { toLedger, toMatchSetups } from "@/lib/ledger";
import { verifyQuotes } from "@/lib/analysis/verifyQuotes";
import { computeTension } from "@/lib/analysis/tension";
import {
  findInEnding,
  findUnfired,
  findUnlinkedPayoffs,
  markUncertain,
  matchesFromExtraction,
  resolveMatches,
} from "@/lib/analysis/resolve";
import { QuotaExhaustedError, RateLimitedError } from "@/lib/pipeline/errors";

export { RateLimitedError, QuotaExhaustedError, ChapterFailedError } from "@/lib/pipeline/errors";

export interface PipelineDeps {
  meta(): Promise<{ model: string; promptVersions: { extract: string; match: string } }>;
  extract(req: ExtractRequest): Promise<RawExtraction>;
  match(req: MatchRequest): Promise<RawMatches>;
  cache: CacheStore;
  sleep(ms: number): Promise<void>;
}

/** A gun found while reading, and a gun that fired, for the live "Found" wall. */
export interface FoundGun {
  id: string;
  chapter: number;
  summary: string;
}
export interface FiredGun {
  setupId: string;
  /** The chapter of the payoff. */
  chapter: number;
}

export type Progress =
  | { stage: "extract"; chapter: number; of: number }
  /** After each chapter: its verified setups, and setups its payoffs fired. */
  | { stage: "found"; chapter: number; setups: FoundGun[]; fired: FiredGun[] }
  /** After the match pass: setups it newly linked to payoffs. */
  | { stage: "linked"; fired: FiredGun[] }
  | { stage: "waiting"; retryInMs: number }
  | { stage: "match" }
  | { stage: "done" };

export type AnalyzeOutcome =
  | { status: "ok"; result: AnalysisResult }
  | { status: "quota_exhausted"; partial: AnalysisResult };

const MAX_WAITS = 5;

/** True when no chapter could be analysed (e.g. missing key, Gemini outage): the report would be empty. */
export function everyChapterFailed(result: AnalysisResult): boolean {
  return result.chapters.length > 0 && result.failedChapters.length >= result.chapters.length;
}

/** Thrown internally when a call keeps being rate limited. */
class TooManyWaits extends Error {}

export async function analyze(
  chapters: Chapter[],
  deps: PipelineDeps,
  onProgress?: (p: Progress) => void,
): Promise<AnalyzeOutcome> {
  const { model, promptVersions } = await deps.meta();
  const emit = (p: Progress) => onProgress?.(p);

  const setups: Setup[] = [];
  const payoffs: Payoff[] = [];
  const failed: number[] = [];
  let dropped = 0;

  /** Run a call, waiting out rate limits (max MAX_WAITS waits). */
  async function withRetry<T>(call: () => Promise<T>): Promise<T> {
    let waits = 0;
    for (;;) {
      try {
        return await call();
      } catch (e) {
        if (!(e instanceof RateLimitedError)) throw e;
        if (waits >= MAX_WAITS) throw new TooManyWaits();
        waits++;
        emit({ stage: "waiting", retryInMs: e.retryAfterMs });
        await deps.sleep(e.retryAfterMs);
      }
    }
  }

  function build(matches: Match[]): AnalysisResult {
    const failedChapters = [...failed].sort((a, b) => a - b);
    const inEnding = findInEnding(chapters, setups, matches);
    const ending = new Set(inEnding);
    return {
      chapters,
      setups,
      payoffs,
      matches,
      unfired: findUnfired(setups, matches).filter((id) => !ending.has(id)),
      inEnding,
      tension: computeTension(chapters.length, setups, payoffs, matches),
      failedChapters,
      uncertain: markUncertain(setups, payoffs, matches, failedChapters),
      droppedQuotes: dropped,
      model,
      promptVersions,
    };
  }

  const extractionMatches = () =>
    resolveMatches(setups, payoffs, matchesFromExtraction(payoffs));

  /** Setups fired by `now` but not in `before`, each with the chapter of its first payoff. */
  function newlyFired(before: Set<string>, now: Match[]): FiredGun[] {
    const chapterOf = new Map(payoffs.map((p) => [p.id, p.chapter]));
    const out = new Map<string, number>();
    for (const m of now) {
      if (before.has(m.setupId) || out.has(m.setupId)) continue;
      out.set(m.setupId, chapterOf.get(m.payoffId) ?? 0);
    }
    return [...out].map(([setupId, chapter]) => ({ setupId, chapter }));
  }

  for (const chapter of chapters) {
    emit({ stage: "extract", chapter: chapter.index, of: chapters.length });
    const ledger = toLedger(setups);
    const key = await extractCacheKey(chapter.text, ledger, promptVersions.extract, model);
    // A cached value that no longer parses (old shape, corrupted storage) is a miss.
    const cached = RawExtraction.safeParse(await deps.cache.get(key));
    let raw: RawExtraction | undefined = cached.success ? cached.data : undefined;
    if (!raw) {
      try {
        raw = await withRetry(() => deps.extract({ chapter, ledger }));
      } catch (e) {
        if (e instanceof QuotaExhaustedError) {
          return { status: "quota_exhausted", partial: build(extractionMatches()) };
        }
        failed.push(chapter.index);
        continue;
      }
      await deps.cache.set(key, raw);
    }

    const n = chapter.index;
    const rawSetups = raw.setups.map((s, i) => ({
      ...s,
      importance: s.importance as Setup["importance"], // schema guarantees an integer 1..3
      id: `c${n}-s${i + 1}`,
      chapter: n,
    }));
    const rawPayoffs = raw.payoffs.map((p, i) => {
      const { firesSetupId, ...rest } = p;
      return {
        ...rest,
        id: `c${n}-p${i + 1}`,
        chapter: n,
        ...(firesSetupId ? { firesSetupId } : {}),
      };
    });
    const vs = verifyQuotes(rawSetups, chapter.text);
    const vp = verifyQuotes(rawPayoffs, chapter.text);
    dropped += vs.dropped + vp.dropped;
    const firedBefore = new Set(extractionMatches().map((m) => m.setupId));
    setups.push(...(vs.kept as Setup[]));
    payoffs.push(...(vp.kept as Payoff[]));
    emit({
      stage: "found",
      chapter: n,
      setups: (vs.kept as Setup[]).map((s) => ({ id: s.id, chapter: n, summary: s.summary })),
      fired: newlyFired(firedBefore, extractionMatches()),
    });
  }

  let matches = extractionMatches();

  const unfiredIds = new Set(findUnfired(setups, matches));
  const unlinkedIds = new Set(findUnlinkedPayoffs(payoffs, matches));
  if (unfiredIds.size > 0 && unlinkedIds.size > 0) {
    emit({ stage: "match" });
    const body: MatchRequest = {
      setups: toMatchSetups(setups.filter((s) => unfiredIds.has(s.id))),
      payoffs: payoffs
        .filter((p) => unlinkedIds.has(p.id))
        .map((p) => ({ id: p.id, chapter: p.chapter, summary: p.summary, quote: p.quote })),
    };
    try {
      const key = await matchCacheKey(body, promptVersions.match, model);
      const cached = RawMatches.safeParse(await deps.cache.get(key));
      let raw: RawMatches | undefined = cached.success ? cached.data : undefined;
      if (!raw) {
        raw = await withRetry(() => deps.match(body));
        await deps.cache.set(key, raw);
      }
      const candidates: Match[] = raw.matches.map((m) => ({ ...m, source: "match" as const }));
      const firedBefore = new Set(matches.map((m) => m.setupId));
      matches = resolveMatches(setups, payoffs, [...matchesFromExtraction(payoffs), ...candidates]);
      emit({ stage: "linked", fired: newlyFired(firedBefore, matches) });
    } catch (e) {
      if (e instanceof QuotaExhaustedError) {
        return { status: "quota_exhausted", partial: build(matches) };
      }
      /* any other failure: skip the pass, keep matches as they are */
    }
  }

  emit({ stage: "done" });
  return { status: "ok", result: build(matches) };
}
