import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { GeminiProvider, type GenAiLike } from "@/lib/ai/provider";
import { RateLimitedError } from "@/lib/pipeline/errors";
import { httpDeps } from "@/lib/pipeline/httpDeps";

const Schema = z.object({ a: z.number() });

/** A model call that hangs until it is aborted, as the free tier sometimes does under load. */
const stalled: GenAiLike = {
  models: {
    generateContent: ({ config }) =>
      new Promise((_, reject) => {
        const signal = config?.abortSignal as AbortSignal;
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
  },
};

describe("a stalled model call", () => {
  it("is cut off and reported as 'busy, retry' instead of running past the host's limit", async () => {
    const p = new GeminiProvider({ apiKey: "k", model: "m", fallbackModel: "", client: stalled, callTimeoutMs: 30 });
    const err = await p.generateJson("hi", Schema).catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitedError);
    expect((err as RateLimitedError).retryAfterMs).toBeGreaterThan(0);
  });

  it("stops retrying invalid JSON once the request's time budget is spent", async () => {
    let calls = 0;
    const slowBadJson: GenAiLike = {
      models: { generateContent: () => new Promise((r) => setTimeout(() => (calls++, r({ text: "not json" })), 40)) },
    };
    const p = new GeminiProvider({ apiKey: "k", model: "m", fallbackModel: "", client: slowBadJson, budgetMs: 1050 });
    const err = await p.generateJson("hi", Schema).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(calls).toBeLessThanOrEqual(3);
  });
});

describe("the browser's requests", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("treat a request the host cut off (504) as a wait, not a lost chapter", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>timeout</html>", { status: 504 })));
    const err = await httpDeps().extract({ chapter: { index: 1, title: "", text: "x" }, ledger: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitedError);
  });

  it("treat a dropped connection as a wait too", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const err = await httpDeps().match({ setups: [], payoffs: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitedError);
  });
});
