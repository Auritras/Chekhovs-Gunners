import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuotaExhaustedError, RateLimitedError, ChapterFailedError } from "@/lib/pipeline/errors";

const generateJson = vi.fn();
vi.mock("@/lib/ai/provider", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/provider")>()),
  providerFromEnv: () => ({ model: "m", generateJson }),
}));

import { POST as extract } from "@/app/api/extract/route";
import { POST as match } from "@/app/api/match/route";
import { GET as meta } from "@/app/api/meta/route";

const body = { chapter: { index: 1, title: "One", text: "Hello." }, ledger: [] };
const req = (b: unknown, ip = "1.1.1.1") =>
  new Request("http://x/api/extract", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: typeof b === "string" ? b : JSON.stringify(b),
  });

beforeEach(() => {
  generateJson.mockReset();
});

describe("routes", () => {
  it("400 on invalid body and malformed JSON", async () => {
    expect((await extract(req({ nope: 1 }))).status).toBe(400);
    const r = await extract(req("{bad"));
    expect(r.status).toBe(400);
    expect(await r.json()).toHaveProperty("error");
  });
  it("quota exhausted -> 429", async () => {
    generateJson.mockImplementation(async () => { throw new QuotaExhaustedError(); });
    const r = await extract(req(body));
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ kind: "quota_exhausted" });
  });
  it("rate limited -> 429 with retryAfterMs", async () => {
    generateJson.mockImplementation(async () => { throw new RateLimitedError(7000); });
    const r = await extract(req(body));
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ kind: "rate_limited", retryAfterMs: 7000 });
  });
  it("chapter failed -> 502, other -> 500", async () => {
    generateJson.mockImplementationOnce(async () => { throw new ChapterFailedError(); });
    expect((await extract(req(body))).status).toBe(502);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    generateJson.mockRejectedValueOnce(new Error("boom: secret detail"));
    const r = await extract(req(body));
    expect(r.status).toBe(500);
    const text = await r.text();
    expect(JSON.parse(text)).toEqual({ kind: "error" });
    expect(text).not.toContain("boom");
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0].join(" ")).toContain("boom: secret detail");
    logged.mockRestore();
  });
  it("success -> 200 with extraction", async () => {
    const out = { setups: [], payoffs: [] };
    generateJson.mockResolvedValue(out);
    const r = await extract(req(body));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual(out);
  });
  it("match works and limiter returns 429 after 30 per IP", async () => {
    generateJson.mockResolvedValue({ matches: [] });
    for (let i = 0; i < 30; i++) {
      expect((await match(req({ setups: [], payoffs: [] }, "9.9.9.9"))).status).toBe(200);
    }
    const r = await match(req({ setups: [], payoffs: [] }, "9.9.9.9"));
    expect(r.status).toBe(429);
    const j = await r.json();
    expect(j.kind).toBe("rate_limited");
    expect(j.retryAfterMs).toBeGreaterThan(0);
  });
  it("meta", async () => {
    const j = await (await meta()).json();
    expect(j.promptVersions).toEqual({ extract: "x2", match: "m2" });
    expect(typeof j.model).toBe("string");
  });
});
