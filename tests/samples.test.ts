import { describe, it, expect } from "vitest";
import {
  findSampleWithResult,
  isAnalysisResult,
  loadSampleIndex,
  loadSampleResult,
} from "@/lib/samples";
import type { AnalysisResult } from "@/lib/types";

const good: AnalysisResult = {
  chapters: [{ index: 1, title: "One", text: "Text." }],
  setups: [],
  payoffs: [],
  matches: [],
  unfired: [],
  tension: [0],
  failedChapters: [],
  uncertain: [],
  droppedQuotes: 0,
  model: "m",
  promptVersions: { extract: "x2", match: "m2" },
};

/** A fake fetch serving a fixed map of url -> JSON body (string bodies are malformed JSON). */
function fakeFetch(files: Record<string, unknown>) {
  const calls: string[] = [];
  const fn = async (url: string) => {
    calls.push(url);
    if (!(url in files)) return { ok: false, json: async () => ({}) };
    const body = files[url];
    return {
      ok: true,
      json: async () => {
        if (typeof body === "string") throw new SyntaxError("bad json");
        return body;
      },
    };
  };
  return { fn, calls };
}

describe("samples", () => {
  it("isAnalysisResult accepts a result and rejects junk", () => {
    expect(isAnalysisResult(good)).toBe(true);
    expect(isAnalysisResult(null)).toBe(false);
    expect(isAnalysisResult({ chapters: [] })).toBe(false);
    expect(isAnalysisResult({ ...good, chapters: [] })).toBe(false);
    expect(isAnalysisResult({ ...good, setups: "x" })).toBe(false);
  });

  it("loadSampleResult returns null when result.json is missing or does not parse", async () => {
    expect(await loadSampleResult("a", fakeFetch({}).fn)).toBeNull();
    expect(await loadSampleResult("a", fakeFetch({ "/samples/a/result.json": "{bad" }).fn)).toBeNull();
    expect(await loadSampleResult("a", fakeFetch({ "/samples/a/result.json": { nope: 1 } }).fn)).toBeNull();
    expect(await loadSampleResult("a", fakeFetch({ "/samples/a/result.json": good }).fn)).toEqual(good);
  });

  it("loadSampleIndex filters malformed entries and survives a missing index", async () => {
    expect(await loadSampleIndex(fakeFetch({}).fn)).toEqual([]);
    const { fn } = fakeFetch({ "/samples/index.json": [{ slug: "a", title: "A" }, { slug: 1 }, null] });
    expect(await loadSampleIndex(fn)).toEqual([{ slug: "a", title: "A" }]);
  });

  it("findSampleWithResult skips samples without a result", async () => {
    const { fn } = fakeFetch({
      "/samples/index.json": [{ slug: "a", title: "A" }, { slug: "b", title: "B" }],
      "/samples/b/result.json": good,
    });
    expect(await findSampleWithResult(fn)).toEqual({ title: "B", result: good });
    expect(await findSampleWithResult(fakeFetch({ "/samples/index.json": [{ slug: "a", title: "A" }] }).fn)).toBeNull();
  });
});
