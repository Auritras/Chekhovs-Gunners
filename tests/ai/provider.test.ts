import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import {
  GeminiProvider,
  classifyGeminiError,
  providerFromEnv,
  type GenAiLike,
} from "@/lib/ai/provider";
import { buildExtractPrompt, buildMatchPrompt } from "@/lib/ai/prompts";
import {
  ChapterFailedError,
  QuotaExhaustedError,
  RateLimitedError,
} from "@/lib/pipeline/errors";

const Schema = z.object({ a: z.number() });

function fake(texts: (string | Error)[]) {
  const generateContent = vi.fn(async () => {
    const next = texts.shift();
    if (next instanceof Error) throw next;
    return { text: next };
  });
  return { client: { models: { generateContent } } as GenAiLike, generateContent };
}

describe("GeminiProvider", () => {
  it("parses valid JSON on first try", async () => {
    const { client, generateContent } = fake(['{"a":1}']);
    const p = new GeminiProvider({ apiKey: "k", model: "m", client });
    expect(await p.generateJson("hi", Schema)).toEqual({ a: 1 });
    const params = generateContent.mock.calls[0] as unknown as [
      { model: string; config: Record<string, unknown> },
    ];
    expect(params[0].model).toBe("m");
    expect(params[0].config.responseMimeType).toBe("application/json");
    expect(params[0].config.temperature).toBe(0.2);
    expect(params[0].config.responseJsonSchema).toBeTruthy();
  });

  it("retries invalid output and succeeds on third call", async () => {
    const { client, generateContent } = fake(["nope", '{"a":"x"}', '{"a":3}']);
    const p = new GeminiProvider({ apiKey: "k", model: "m", client });
    expect(await p.generateJson("hi", Schema)).toEqual({ a: 3 });
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it("throws ChapterFailedError after 3 bad attempts", async () => {
    const { client, generateContent } = fake(["x", "y", undefined as never]);
    const p = new GeminiProvider({ apiKey: "k", model: "m", client });
    await expect(p.generateJson("hi", Schema)).rejects.toBeInstanceOf(ChapterFailedError);
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it("classifies API errors without retrying", async () => {
    const err = Object.assign(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'), {
      status: 429,
    });
    const { client, generateContent } = fake([err]);
    const p = new GeminiProvider({ apiKey: "k", model: "m", client });
    await expect(p.generateJson("hi", Schema)).rejects.toBeInstanceOf(RateLimitedError);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});

describe("classifyGeminiError", () => {
  const mk = (body: object, status = 429) =>
    Object.assign(new Error(JSON.stringify(body)), { status });

  it("daily quota -> QuotaExhaustedError", () => {
    const e = classifyGeminiError(
      mk({
        error: {
          code: 429,
          status: "RESOURCE_EXHAUSTED",
          details: [
            {
              violations: [
                { quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" },
              ],
            },
          ],
        },
      }),
    );
    expect(e).toBeInstanceOf(QuotaExhaustedError);
  });

  it("per-minute 429 uses retryDelay", () => {
    const e = classifyGeminiError(
      mk({
        error: {
          code: 429,
          details: [
            { violations: [{ quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" }] },
            { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "7s" },
          ],
        },
      }),
    );
    expect(e).toBeInstanceOf(RateLimitedError);
    expect((e as RateLimitedError).retryAfterMs).toBe(7000);
  });

  it("defaults to 15000ms without retryDelay", () => {
    const e = classifyGeminiError(mk({ error: { code: 429 } }));
    expect((e as RateLimitedError).retryAfterMs).toBe(15000);
  });

  it("returns non-429 errors unchanged", () => {
    const orig = Object.assign(new Error("boom"), { status: 500 });
    expect(classifyGeminiError(orig)).toBe(orig);
    expect(classifyGeminiError("str")).toBeInstanceOf(Error);
  });
});

describe("providerFromEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prefers dev key outside production and defaults model", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("GEMINI_API_KEY_DEV", "dev");
    vi.stubEnv("GEMINI_API_KEY", "prod");
    vi.stubEnv("GEMINI_MODEL", "");
    expect(providerFromEnv().model).toBe("gemini-2.5-flash");
  });

  it("throws naming the missing variable", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(() => providerFromEnv()).toThrow(/GEMINI_API_KEY/);
  });
});

describe("prompts", () => {
  it("extract prompt includes ledger ids and chapter text", () => {
    const text = "The pistol hung above the mantel. Nobody touched it.";
    const p = buildExtractPrompt({
      chapter: { index: 3, title: "Rain", text },
      ledger: [
        { id: "s-abc", chapter: 1, kind: "object", summary: "A pistol" },
        { id: "s-def", chapter: 2, kind: "secret", summary: "A letter" },
      ],
    });
    for (const s of ["s-abc", "s-def", text, "Rain"]) expect(p).toContain(s);
  });

  it("match prompt lists ids", () => {
    const p = buildMatchPrompt({
      setups: [{ id: "s1", chapter: 1, kind: "object", summary: "gun" }],
      payoffs: [{ id: "p1", chapter: 4, summary: "fired", quote: "the gun went off" }],
    });
    expect(p).toContain("s1");
    expect(p).toContain("p1");
  });
});
