import type { z } from "zod";
import { providerFromEnv, type ModelProvider } from "@/lib/ai/provider";
import {
  ChapterFailedError,
  QuotaExhaustedError,
  RateLimitedError,
} from "@/lib/pipeline/errors";
import { createLimiter } from "@/lib/server/limiter";

const limiter = createLimiter({ limit: 30, windowMs: 60_000 });

function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

/** Shared handler for the extract/match routes. */
export async function handleModelRoute<Req, Res>(
  req: Request,
  requestSchema: z.ZodType<Req>,
  responseSchema: z.ZodType<Res>,
  buildPrompt: (body: Req) => string,
): Promise<Response> {
  const key = clientKey(req);
  if (!limiter.check(key)) {
    return Response.json(
      { kind: "rate_limited", retryAfterMs: limiter.retryAfterMs(key) },
      { status: 429 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Malformed JSON body" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const provider: ModelProvider = providerFromEnv();
    const out = await provider.generateJson(buildPrompt(parsed.data), responseSchema);
    return Response.json(out);
  } catch (e) {
    if (e instanceof RateLimitedError) {
      return Response.json(
        { kind: "rate_limited", retryAfterMs: e.retryAfterMs },
        { status: 429 },
      );
    }
    if (e instanceof QuotaExhaustedError) {
      return Response.json({ kind: "quota_exhausted" }, { status: 429 });
    }
    if (e instanceof ChapterFailedError) {
      return Response.json({ kind: "chapter_failed" }, { status: 502 });
    }
    // Log the cause server-side only; the response never carries it.
    console.error("[model route] unexpected error:", e instanceof Error ? e.message : String(e));
    return Response.json({ kind: "error" }, { status: 500 });
  }
}
