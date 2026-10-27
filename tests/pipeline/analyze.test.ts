import { describe, expect, it } from "vitest";
import { analyze, type PipelineDeps, type Progress } from "@/lib/pipeline/analyze";
import { ChapterFailedError, QuotaExhaustedError, RateLimitedError } from "@/lib/pipeline/errors";
import { memoryCache } from "@/lib/cache";
import type { Chapter } from "@/lib/types";
import type { ExtractRequest, MatchRequest, RawExtraction, RawMatches } from "@/lib/ai/schemas";

const chapters: Chapter[] = [
  { index: 1, title: "One", text: "A rusty key hung by the door. Nothing else happened here." },
  { index: 2, title: "Two", text: "She opened the cellar with the rusty key at last." },
  { index: 3, title: "Three", text: "The end came quietly to everyone in the house." },
];

const empty: RawExtraction = { setups: [], payoffs: [] };

function makeDeps(
  extract: (req: ExtractRequest, n: number) => Promise<RawExtraction> | RawExtraction,
  match?: (req: MatchRequest) => Promise<RawMatches> | RawMatches,
) {
  const calls = { extract: [] as ExtractRequest[], match: [] as MatchRequest[], sleep: [] as number[] };
  const deps: PipelineDeps = {
    meta: async () => ({ model: "m", promptVersions: { extract: "e1", match: "m1" } }),
    extract: async (req) => {
      calls.extract.push(req);
      return extract(req, req.chapter.index);
    },
    match: async (req) => {
      calls.match.push(req);
      return match ? match(req) : { matches: [] };
    },
    cache: memoryCache(),
    sleep: async (ms) => {
      calls.sleep.push(ms);
    },
  };
  return { deps, calls };
}

const ch1: RawExtraction = {
  setups: [
    { quote: "A rusty key hung by the door.", kind: "object", summary: "rusty key", importance: 2 },
    { quote: "this quote is not in the text", kind: "other", summary: "bogus", importance: 1 },
  ],
  payoffs: [],
};

describe("analyze", () => {
  it("gives chapter 2 a ledger of verified chapter 1 setups only", async () => {
    const { deps, calls } = makeDeps((_r, n) => (n === 1 ? ch1 : empty));
    const out = await analyze(chapters, deps);
    expect(out.status).toBe("ok");
    expect(calls.extract[1].ledger).toEqual([
      { id: "c1-s1", chapter: 1, kind: "object", summary: "rusty key" },
    ]);
    if (out.status === "ok") {
      expect(out.result.droppedQuotes).toBe(1);
      expect(out.result.model).toBe("m");
      expect(out.result.setups[0]).toMatchObject({ id: "c1-s1", start: 0 });
    }
  });

  it("links via firesSetupId without calling match", async () => {
    const { deps, calls } = makeDeps((_r, n) =>
      n === 1
        ? ch1
        : n === 2
          ? { setups: [], payoffs: [{ quote: "opened the cellar with the rusty key", summary: "used", firesSetupId: "c1-s1" }] }
          : empty,
    );
    const out = await analyze(chapters, deps);
    expect(calls.match).toHaveLength(0);
    if (out.status !== "ok") throw new Error("expected ok");
    expect(out.result.matches).toEqual([
      { setupId: "c1-s1", payoffId: "c2-p1", reasoning: "", source: "extract" },
    ]);
    expect(out.result.unfired).toEqual([]);
  });

  it("runs the match pass for leftovers and tags source match", async () => {
    const { deps, calls } = makeDeps(
      (_r, n) =>
        n === 1
          ? ch1
          : n === 2
            ? { setups: [], payoffs: [{ quote: "opened the cellar with the rusty key", summary: "used", firesSetupId: null }] }
            : empty,
      () => ({ matches: [{ setupId: "c1-s1", payoffId: "c2-p1", reasoning: "same key" }] }),
    );
    const progress: Progress[] = [];
    const out = await analyze(chapters, deps, (p) => progress.push(p));
    expect(calls.match).toHaveLength(1);
    expect(Object.keys(calls.match[0])).toEqual(["setups", "payoffs"]);
    expect(calls.match[0].payoffs[0]).toEqual({
      id: "c2-p1",
      chapter: 2,
      summary: "used",
      quote: "opened the cellar with the rusty key",
    });
    if (out.status !== "ok") throw new Error("expected ok");
    expect(out.result.matches[0]).toMatchObject({ source: "match", reasoning: "same key" });
    expect(progress.some((p) => p.stage === "match")).toBe(true);
    expect(progress.at(-1)).toEqual({ stage: "done" });
    expect(progress[0]).toEqual({ stage: "extract", chapter: 1, of: 3 });
  });

  it("makes zero extract calls on a second run", async () => {
    const { deps, calls } = makeDeps((_r, n) => (n === 1 ? ch1 : empty));
    await analyze(chapters, deps);
    const before = calls.extract.length;
    await analyze(chapters, deps);
    expect(calls.extract.length).toBe(before);
  });

  it("handles a failed chapter and a rate limit, then re-runs only what changed", async () => {
    let ch3Limited = false;
    let ch2Works = false;
    const progress: Progress[] = [];
    const { deps, calls } = makeDeps((_r, n) => {
      if (n === 1) return ch1;
      if (n === 2) {
        if (!ch2Works) throw new ChapterFailedError();
        return { setups: [{ quote: "opened the cellar", kind: "other", summary: "cellar", importance: 1 }], payoffs: [] };
      }
      if (!ch3Limited) {
        ch3Limited = true;
        throw new RateLimitedError(1000);
      }
      return empty;
    });
    const out = await analyze(chapters, deps, (p) => progress.push(p));
    if (out.status !== "ok") throw new Error("expected ok");
    expect(out.result.failedChapters).toEqual([2]);
    expect(calls.sleep).toEqual([1000]);
    expect(progress).toContainEqual({ stage: "waiting", retryInMs: 1000 });
    expect(out.result.chapters).toHaveLength(3);

    ch2Works = true;
    calls.extract.length = 0;
    const out2 = await analyze(chapters, deps);
    expect(calls.extract.map((r) => r.chapter.index)).toEqual([2, 3]);
    if (out2.status !== "ok") throw new Error("expected ok");
    expect(out2.result.failedChapters).toEqual([]);
  });

  it("returns quota_exhausted with a partial result", async () => {
    const { deps } = makeDeps((_r, n) => {
      if (n === 3) throw new QuotaExhaustedError();
      return n === 1 ? ch1 : empty;
    });
    const out = await analyze(chapters, deps);
    expect(out.status).toBe("quota_exhausted");
    if (out.status !== "quota_exhausted") return;
    expect(out.partial.chapters).toHaveLength(3);
    expect(out.partial.setups.map((s) => s.id)).toEqual(["c1-s1"]);
    expect(out.partial.failedChapters).toEqual([]);
  });

  it("fails a chapter after 5 waits", async () => {
    const { deps, calls } = makeDeps((_r, n) => {
      if (n === 2) throw new RateLimitedError(10);
      return empty;
    });
    const out = await analyze(chapters, deps);
    if (out.status !== "ok") throw new Error("expected ok");
    expect(calls.sleep).toHaveLength(5);
    expect(out.result.failedChapters).toEqual([2]);
  });
});
