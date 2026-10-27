import { localStorageCache } from "@/lib/cache";
import type { PipelineDeps } from "@/lib/pipeline/analyze";
import {
  ChapterFailedError,
  QuotaExhaustedError,
  RateLimitedError,
} from "@/lib/pipeline/errors";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return (await res.json()) as T;
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
