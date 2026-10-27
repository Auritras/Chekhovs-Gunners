import { describe, it, expect } from "vitest";
import { computeTension } from "@/lib/analysis/tension";
import type { Setup, Payoff, Match } from "@/lib/types";

describe("computeTension", () => {
  it("sums importance of open setups per chapter", () => {
    const setups: Setup[] = [
      { id: "A", chapter: 1, quote: "q", start: 0, end: 1, kind: "object", summary: "", importance: 3 },
      { id: "B", chapter: 2, quote: "q", start: 0, end: 1, kind: "object", summary: "", importance: 1 },
    ];
    const payoffs: Payoff[] = [{ id: "P", chapter: 3, quote: "q", start: 0, end: 1, summary: "" }];
    const matches: Match[] = [{ setupId: "A", payoffId: "P", reasoning: "", source: "match" }];
    expect(computeTension(4, setups, payoffs, matches)).toEqual([3, 4, 1, 1]);
  });
});
