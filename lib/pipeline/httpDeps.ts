import { localStorageCache } from "@/lib/cache";
import type { PipelineDeps } from "@/lib/pipeline/analyze";
import {
  ChapterFailedError,
  QuotaExhaustedError,
  RateLimitedError,
} from "@/lib/pipeline/errors";

/** A request the host cut off (or the connection dropped) is worth another try after a short wait. */
const RETRY_AFTER_CUTOFF_MS = 5_000;

async function post<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new RateLimitedError(RETRY_AFTER_CUTOFF_MS, "Network error");
  }
  if (res.ok) return (await res.json()) as T;
  // 504: the host stopped a request that ran too long. Wait and retry, don't lose the chapter.
  if (res.status === 504) throw new RateLimitedError(RETRY_AFTER_CUTOFF_MS, "Request timed out");
  let err: { kind?: string; retryAfterMs?: number } = {};
  try {
    err = await res.json();
  } catch {
    // non-JSON error body
  }
  if (err.kind === "rate_limited") throw new RateLimitedError(err.retryAfterMs ?? 15_000);
  if (err.kind === "quota_exhausted") throw new QuotaExhaustedError();
  throw new ChapterFailedError(`Request to ${url} failed (${res.status})`);
}

export function httpDeps(): PipelineDeps {
  return {
    async meta() {
      const res = await fetch("/api/meta");
      if (!res.ok) throw new Error(`meta failed (${res.status})`);
      return res.json();
    },
    extract: (req) => post("/api/extract", req),
    match: (req) => post("/api/match", req),
    cache: localStorageCache(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}
