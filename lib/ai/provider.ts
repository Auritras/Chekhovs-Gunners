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

const MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_MS = 15_000;

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
  private client: GenAiLike;

  constructor(opts: { apiKey: string; model: string; client?: GenAiLike }) {
    this.model = opts.model;
    this.client =
      opts.client ?? (new GoogleGenAI({ apiKey: opts.apiKey }) as unknown as GenAiLike);
  }

  async generateJson<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    const responseJsonSchema = toGeminiSchema(schema);
    let lastReason = "unknown";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let text: string | undefined;
      try {
        const res = await this.client.models.generateContent({
          model: this.model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema,
            temperature: 0.2,
          },
        });
        text = res.text;
      } catch (err) {
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

export function classifyGeminiError(
  err: unknown,
): RateLimitedError | QuotaExhaustedError | Error {
  const text = errorText(err);
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
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return new GeminiProvider({ apiKey, model });
}
