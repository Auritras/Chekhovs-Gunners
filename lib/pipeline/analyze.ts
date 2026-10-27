import type { AnalysisResult, Chapter, Match, Payoff, Setup } from "@/lib/types";
import type { ExtractRequest, MatchRequest, RawExtraction, RawMatches } from "@/lib/ai/schemas";
import { extractCacheKey, matchCacheKey, type CacheStore } from "@/lib/cache";
import { toLedger, toMatchSetups } from "@/lib/ledger";
import { verifyQuotes } from "@/lib/analysis/verifyQuotes";
import { computeTension } from "@/lib/analysis/tension";
import {
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

export type Progress =
  | { stage: "extract"; chapter: number; of: number }
  | { stage: "waiting"; retryInMs: number }
  | { stage: "match" }
  | { stage: "done" };

export type AnalyzeOutcome =
  | { status: "ok"; result: AnalysisResult }
  | { status: "quota_exhausted"; partial: AnalysisResult };

const MAX_WAITS = 5;

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
    return {
      chapters,
      setups,
      payoffs,
      matches,
      unfired: findUnfired(setups, matches),
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

  for (const chapter of chapters) {
    emit({ stage: "extract", chapter: chapter.index, of: chapters.length });
    const ledger = toLedger(setups);
    const key = await extractCacheKey(chapter.text, ledger, promptVersions.extract, model);
    let raw = (await deps.cache.get(key)) as RawExtraction | undefined;
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
    setups.push(...(vs.kept as Setup[]));
    payoffs.push(...(vp.kept as Payoff[]));
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
      let raw = (await deps.cache.get(key)) as RawMatches | undefined;
      if (!raw) {
        raw = await withRetry(() => deps.match(body));
        await deps.cache.set(key, raw);
      }
      const candidates: Match[] = raw.matches.map((m) => ({ ...m, source: "match" as const }));
      matches = resolveMatches(setups, payoffs, [...matchesFromExtraction(payoffs), ...candidates]);
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
