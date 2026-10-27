import { describe, expect, it } from "vitest";
import {
  ExtractRequest,
  MatchRequest,
  RawExtraction,
  RawMatches,
} from "@/lib/ai/schemas";

const validExtraction = {
  setups: [
    { quote: "A gun hung on the wall.", kind: "object", summary: "A gun is shown", importance: 3 },
  ],
  payoffs: [{ quote: "He fired the gun.", summary: "The gun is used", firesSetupId: null }],
};

const entry = (i: number) => ({ id: `s${i}`, chapter: 1, kind: "object" as const, summary: "x" });

describe("RawExtraction", () => {
  it("accepts a valid object", () => {
    expect(RawExtraction.safeParse(validExtraction).success).toBe(true);
  });

  it("rejects importance 4", () => {
    const bad = structuredClone(validExtraction);
    bad.setups[0].importance = 4;
    expect(RawExtraction.safeParse(bad).success).toBe(false);
  });

  it('rejects kind "weapon"', () => {
    const bad = structuredClone(validExtraction);
    bad.setups[0].kind = "weapon";
    expect(RawExtraction.safeParse(bad).success).toBe(false);
  });
});

describe("RawMatches", () => {
  it("accepts a valid object", () => {
    expect(
      RawMatches.safeParse({ matches: [{ setupId: "s1", payoffId: "p1", reasoning: "r" }] }).success,
    ).toBe(true);
  });
});

describe("ExtractRequest", () => {
  const chapter = (len: number) => ({ index: 1, title: "One", text: "a".repeat(len) });

  it("accepts a chapter of 60,000 characters", () => {
    expect(ExtractRequest.safeParse({ chapter: chapter(60000), ledger: [] }).success).toBe(true);
  });

  it("rejects a chapter of 60,001 characters", () => {
    expect(ExtractRequest.safeParse({ chapter: chapter(60001), ledger: [] }).success).toBe(false);
  });

  it("accepts 400 ledger entries and rejects 401", () => {
    const ok = Array.from({ length: 400 }, (_, i) => entry(i));
    expect(ExtractRequest.safeParse({ chapter: chapter(5), ledger: ok }).success).toBe(true);
    expect(
      ExtractRequest.safeParse({ chapter: chapter(5), ledger: [...ok, entry(400)] }).success,
    ).toBe(false);
  });
});

describe("MatchRequest", () => {
  it("rejects 401 setups", () => {
    const setups = Array.from({ length: 401 }, (_, i) => entry(i));
    expect(MatchRequest.safeParse({ setups, payoffs: [] }).success).toBe(false);
  });

  it("rejects 401 payoffs and accepts 400", () => {
    const p = (i: number) => ({ id: `p${i}`, chapter: 2, summary: "s", quote: "q" });
    expect(
      MatchRequest.safeParse({ setups: [], payoffs: Array.from({ length: 400 }, (_, i) => p(i)) }).success,
    ).toBe(true);
    expect(
      MatchRequest.safeParse({ setups: [], payoffs: Array.from({ length: 401 }, (_, i) => p(i)) }).success,
    ).toBe(false);
  });
});
