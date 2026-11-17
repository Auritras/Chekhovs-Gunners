import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import {
  ChapterFailedError,
  QuotaExhaustedError,
  RateLimitedError,
} from "@/lib/pipeline/errors";

export interface ModelProvider {
  readonly model: string;
  generateJson<T>(prompt: string, schema: z.ZodType<T>): Promise<T>;
}

/** Minimal structural type of the SDK client, so tests can inject a fake. */
export interface GenAiLike {
  models: {
    generateContent(params: {
      model: string;
      contents: string;
      config?: Record<string, unknown>;
    }): Promise<{ text?: string | undefined }>;
  };
}

export const DEFAULT_MODEL = "gemini-3.5-flash";
/** Measured on the sample: "medium" ≈ 27 s/chapter and finds every planted setup; "low" ≈ 3 s but misses subtle ones. */
export const DEFAULT_THINKING_LEVEL = "medium";
/** Free tier allows the default model only 20 requests/day/project; the lite model has its own quota (≈6 s/chapter, found every setup on the sample at medium). */
export const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";
const MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_MS = 15_000;
const UNAVAILABLE_RETRY_MS = 10_000;
/**
 * One model call may take this long. Under load the free tier can stall for minutes, and Vercel
 * kills a request after 120 s (maxDuration), which would lose the chapter. Instead the server
 * gives up in time and answers "busy, try again" so the browser waits and retries.
 */
export const CALL_TIMEOUT_MS = 50_000;
/** Total time for one request, across the attempts for invalid JSON, well inside maxDuration. */
export const REQUEST_BUDGET_MS = 100_000;
/** After a timeout the browser waits this long before asking again. */
const TIMEOUT_RETRY_MS = 5_000;
/** How long to skip a model after its daily quota runs out before probing it again. */
const EXHAUSTED_SKIP_MS = 60 * 60 * 1000;

/** Models whose daily quota ran out, until when to skip them. Module-level so it outlives one request's provider. */
const exhaustedUntil = new Map<string, number>();
/** Models that just answered "overloaded" (503) or stalled: tried last for a couple of minutes. */
const busyUntil = new Map<string, number>();
const BUSY_SKIP_MS = 2 * 60 * 1000;

export function resetExhaustedModels(): void {
  exhaustedUntil.clear();
  busyUntil.clear();
}

/** The model is overloaded or stalled (not a rate limit on us): another model may answer at once. */
export class ModelBusyError extends RateLimitedError {
  constructor(retryAfterMs: number, message: string) {
    super(retryAfterMs, message);
    this.name = "ModelBusyError";
  }
}

/** Gemini's responseJsonSchema rejects `$schema`; drop it (and `additionalProperties`) recursively. */
function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "$schema" || k === "additionalProperties") continue;
      out[k] = stripUnsupported(v);
    }
    return out;
  }
  return node;
}

export function toGeminiSchema(schema: z.ZodType): unknown {
  return stripUnsupported(z.toJSONSchema(schema));
}

export class GeminiProvider implements ModelProvider {
  readonly model: string;
  /** Empty string sends no thinking config (model default). */
  readonly thinkingLevel: string;
  /** Used for the rest of the hour when `model`'s daily quota is used up. */
  readonly fallbackModel: string | undefined;
  private client: GenAiLike;
  private now: () => number;
  private callTimeoutMs: number;
  private budgetMs: number;

  constructor(opts: {
    apiKey: string;
    model: string;
    thinkingLevel?: string;
    fallbackModel?: string;
    client?: GenAiLike;
    now?: () => number;
    /** Tests shorten these. */
    callTimeoutMs?: number;
    budgetMs?: number;
  }) {
    this.model = opts.model;
    this.thinkingLevel = opts.thinkingLevel ?? DEFAULT_THINKING_LEVEL;
    this.fallbackModel = opts.fallbackModel || undefined;
    this.client =
      opts.client ?? (new GoogleGenAI({ apiKey: opts.apiKey }) as unknown as GenAiLike);
    this.now = opts.now ?? Date.now;
    this.callTimeoutMs = opts.callTimeoutMs ?? CALL_TIMEOUT_MS;
    this.budgetMs = opts.budgetMs ?? REQUEST_BUDGET_MS;
  }

  async generateJson<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    const models = [this.model, this.fallbackModel].filter((m): m is string => !!m);
    const now = this.now();
    // Skip models out of daily quota; try models that were just overloaded last.
    const available = models
      .filter((m) => (exhaustedUntil.get(m) ?? 0) <= now)
      .sort((a, b) => Number((busyUntil.get(a) ?? 0) > now) - Number((busyUntil.get(b) ?? 0) > now));
    // One time budget for the whole request, across models, well inside the host's limit.
    const deadline = Date.now() + this.budgetMs;
    let lastQuotaError: QuotaExhaustedError | undefined;
    let lastBusy: ModelBusyError | undefined;
    for (const model of available) {
      try {
        const out = await this.callModel(model, prompt, schema, deadline);
        busyUntil.delete(model);
        return out;
      } catch (err) {
        if (err instanceof QuotaExhaustedError) {
          exhaustedUntil.set(model, this.now() + EXHAUSTED_SKIP_MS);
          lastQuotaError = err;
        } else if (err instanceof ModelBusyError) {
          // Overloaded or stalled: the next model (the lite one) usually answers right away.
          busyUntil.set(model, this.now() + BUSY_SKIP_MS);
          lastBusy = err;
        } else {
          throw err;
        }
      }
    }
    throw lastBusy ?? lastQuotaError ?? new QuotaExhaustedError("Daily quota used up for every configured model");
  }

  private async callModel<T>(model: string, prompt: string, schema: z.ZodType<T>, deadline: number): Promise<T> {
    const responseJsonSchema = toGeminiSchema(schema);
    let lastReason = "unknown";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const left = deadline - Date.now();
      if (left <= 1_000) throw new ModelBusyError(TIMEOUT_RETRY_MS, "Model too slow; out of time for this request");
      const signal = AbortSignal.timeout(Math.min(this.callTimeoutMs, left));
      let text: string | undefined;
      try {
        const res = await this.client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema,
            temperature: 0.2,
            ...(this.thinkingLevel ? { thinkingConfig: { thinkingLevel: this.thinkingLevel } } : {}),
            abortSignal: signal,
          },
        });
        text = res.text;
      } catch (err) {
        // A stalled call: ask the browser to wait a moment and try again, rather than fail.
        if (signal.aborted) throw new ModelBusyError(TIMEOUT_RETRY_MS, "Model call timed out");
        throw classifyGeminiError(err);
      }
      try {
        if (!text) throw new Error("empty response");
        return schema.parse(JSON.parse(text));
      } catch (err) {
        lastReason = err instanceof Error ? err.message : String(err);
      }
    }
    throw new ChapterFailedError(
      `Model returned invalid JSON after ${MAX_ATTEMPTS} attempts: ${lastReason.slice(0, 200)}`,
    );
  }
}

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function is429(err: unknown, text: string): boolean {
  if (err && typeof err === "object") {
    const o = err as { status?: unknown; code?: unknown };
    if (o.status === 429 || o.code === 429) return true;
  }
  return /\b429\b|RESOURCE_EXHAUSTED/.test(text);
}

function is503(err: unknown, text: string): boolean {
  if (err && typeof err === "object") {
    const o = err as { status?: unknown; code?: unknown };
    if (o.status === 503 || o.code === 503) return true;
  }
  return /"status"\s*:\s*"UNAVAILABLE"/.test(text);
}

export function classifyGeminiError(
  err: unknown,
): RateLimitedError | QuotaExhaustedError | Error {
  const text = errorText(err);
  // 503 "high demand" is temporary: try the other model, else wait and retry like a per-minute limit.
  if (is503(err, text)) return new ModelBusyError(UNAVAILABLE_RETRY_MS, text);
  if (!is429(err, text)) return err instanceof Error ? err : new Error(text);

  if (/PerDay|per day/i.test(text)) return new QuotaExhaustedError(text);

  const m = /retryDelay\\?"?\s*[:=]\s*\\?"?(\d+(?:\.\d+)?)s/.exec(text);
  const ms = m ? Math.round(parseFloat(m[1]) * 1000) : DEFAULT_RETRY_MS;
  return new RateLimitedError(ms, text);
}

export function providerFromEnv(): ModelProvider {
  const devKey =
    process.env.NODE_ENV !== "production" ? process.env.GEMINI_API_KEY_DEV : undefined;
  const apiKey = devKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key: set GEMINI_API_KEY (production) or GEMINI_API_KEY_DEV (local development).",
    );
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const thinkingLevel = process.env.GEMINI_THINKING_LEVEL ?? DEFAULT_THINKING_LEVEL;
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL ?? DEFAULT_FALLBACK_MODEL;
  return new GeminiProvider({ apiKey, model, thinkingLevel, fallbackModel });
}
