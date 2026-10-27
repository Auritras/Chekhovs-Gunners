import { describe, it, expect } from "vitest";
import { toLedger } from "@/lib/ledger";
import type { Setup } from "@/lib/types";

const s = (id: string, chapter: number, start: number, summary = "x"): Setup => ({
  id, chapter, quote: "q", start, end: start + 1, kind: "object", summary, importance: 2,
});

describe("toLedger", () => {
  it("orders by chapter then start and keeps only ledger fields", () => {
    const l = toLedger([s("c", 2, 0), s("b", 1, 50), s("a", 1, 5)]);
    expect(l.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(Object.keys(l[0]).sort()).toEqual(["chapter", "id", "kind", "summary"]);
  });
  it("truncates summaries to 160 chars", () => {
    const [e] = toLedger([s("a", 1, 0, "y".repeat(300))]);
    expect(e.summary).toHaveLength(160);
    expect(e.summary.endsWith("…")).toBe(true);
    expect(toLedger([s("a", 1, 0, "z".repeat(160))])[0].summary).toHaveLength(160);
  });
});
