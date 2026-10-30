import type { AnalysisResult } from "@/lib/types";

export type SampleInfo = { slug: string; title: string; genre?: string };

type Fetch = (url: string) => Promise<Pick<Response, "ok" | "json">>;

const defaultFetch: Fetch = (url) => fetch(url);

/** Loose shape check for a prebuilt sample result (it is our own static file). */
export function isAnalysisResult(x: unknown): x is AnalysisResult {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    ["chapters", "setups", "payoffs", "matches", "unfired", "tension", "failedChapters", "uncertain"].every(
      (k) => Array.isArray(r[k]),
    ) && (r.chapters as unknown[]).length > 0
  );
}

/** The sample list from /samples/index.json, or [] if it is missing or malformed. */
export async function loadSampleIndex(fetchFn: Fetch = defaultFetch): Promise<SampleInfo[]> {
  try {
    const r = await fetchFn("/samples/index.json");
    if (!r.ok) return [];
    const data: unknown = await r.json();
    if (!Array.isArray(data)) return [];
    return data.filter(
      (s): s is SampleInfo => !!s && typeof s.slug === "string" && typeof s.title === "string",
    );
  } catch {
    return [];
  }
}

/**
 * The prebuilt analysis for a sample (/samples/<slug>/result.json, written by
 * `npm run build-samples`), or null if it does not exist or does not parse.
 */
export async function loadSampleResult(
  slug: string,
  fetchFn: Fetch = defaultFetch,
): Promise<AnalysisResult | null> {
  try {
    const r = await fetchFn(`/samples/${encodeURIComponent(slug)}/result.json`);
    if (!r.ok) return null;
    const data: unknown = await r.json();
    return isAnalysisResult(data) ? data : null;
  } catch {
    return null;
  }
}

/** The first sample that has a prebuilt result, for the quota / failure fallback. */
export async function findSampleWithResult(
  fetchFn: Fetch = defaultFetch,
): Promise<{ title: string; result: AnalysisResult } | null> {
  for (const s of await loadSampleIndex(fetchFn)) {
    const result = await loadSampleResult(s.slug, fetchFn);
    if (result) return { title: s.title, result };
  }
  return null;
}
