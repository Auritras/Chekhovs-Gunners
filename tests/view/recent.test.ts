import { describe, expect, it } from "vitest";
import { storyTitle } from "@/lib/view/recent";
import type { AnalysisResult } from "@/lib/types";

const withText = (text: string, title = "Chapter 1: The Seed Packet") =>
  ({ chapters: [{ index: 1, title, text }] }) as unknown as AnalysisResult;

describe("storyTitle", () => {
  it("uses a short first line as the title", () => {
    expect(storyTitle(withText("Four Notes\n\nA test story\n\nOn Ares Ridge..."))).toBe("Four Notes");
  });
  it("falls back to the first chapter's heading when the story starts with prose", () => {
    expect(storyTitle(withText("On Ares Ridge the greenhouse was the only room that smelled of anything."))).toBe(
      "Chapter 1: The Seed Packet",
    );
    expect(storyTitle(withText("It was late.", ""))).toBe("Untitled story");
  });
});
