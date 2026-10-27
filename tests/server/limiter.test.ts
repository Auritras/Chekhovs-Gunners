import { describe, it, expect } from "vitest";
import { createLimiter } from "@/lib/server/limiter";

describe("createLimiter", () => {
  it("allows 30 calls, blocks the 31st, allows again after the window", () => {
    let t = 0;
    const l = createLimiter({ limit: 30, windowMs: 60_000, now: () => t });
    for (let i = 0; i < 30; i++) expect(l.check("a")).toBe(true);
    expect(l.check("a")).toBe(false);
    expect(l.retryAfterMs("a")).toBe(60_000);
    expect(l.check("b")).toBe(true);
    t = 60_001;
    expect(l.check("a")).toBe(true);
  });
});
