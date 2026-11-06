import { describe, expect, it } from "vitest";
import { decodeReport, encodeReport, type SharedReport } from "@/lib/view/share";

const report: SharedReport = {
  title: "Four Notes",
  result: {
    chapters: [{ index: 1, title: "One", text: "A red valve hung on the wall. Nobody touched it." }],
    setups: [{ id: "s1", chapter: 1, quote: "A red valve hung on the wall.", start: 0, end: 29, kind: "object", summary: "The valve", importance: 3 }],
    payoffs: [],
    matches: [],
    unfired: ["s1"],
    tension: [3],
    failedChapters: [],
    uncertain: [],
    droppedQuotes: 0,
    model: "gemini",
    promptVersions: { extract: "x2", match: "m2" },
  },
  overrides: { s1: { kind: "dismissed" } },
  guns: [],
};

describe("share links", () => {
  it("round-trips a report through the URL fragment", async () => {
    const fragment = await encodeReport(report);
    expect(fragment).toMatch(/^r=[A-Za-z0-9_-]+$/);
    expect(await decodeReport(`#${fragment}`)).toEqual(report);
  });

  it("rejects fragments that are not reports, or not well-formed", async () => {
    expect(await decodeReport("#section-2")).toBeNull();
    expect(await decodeReport("#r=not-really-compressed")).toBeNull();
    const bad = await encodeReport({ ...report, result: { ...report.result, chapters: [] } });
    expect(await decodeReport(bad)).toBeNull();
  });
});
