import type { AnalysisResult } from "@/lib/types";
import { isWriterGun, type Overrides } from "@/lib/view/overrides";
import { summaryCounts } from "@/lib/view/summaryCounts";

export type Emblem = "gun" | "curtain" | "quill" | "moon" | "star";

export interface Achievement {
  id: string;
  /** A word or two. */
  title: string;
  /** Why it was unlocked. */
  text: string;
  emblem: Emblem;
}

export const ACHIEVEMENTS: Achievement[] = [
  // About the story
  { id: "chekhov-approves", title: "Chekhov Approves", text: "Every gun planted in your story fires by the end.", emblem: "curtain" },
  { id: "the-original", title: "The Original", text: "A real gun hangs on the wall in chapter 1, and it goes off later.", emblem: "gun" },
  { id: "long-fuse", title: "Long Fuse", text: "A gun planted in chapter 1 waits until the final chapter to fire.", emblem: "gun" },
  { id: "same-scene", title: "Same Scene", text: "A gun is planted and fired within a single chapter.", emblem: "gun" },
  { id: "full-house", title: "Full House", text: "Your story plants ten or more guns.", emblem: "curtain" },
  { id: "promise-kept", title: "Promise Kept", text: "A character makes a promise, and the story keeps it.", emblem: "quill" },
  { id: "double-tap", title: "Double Tap", text: "One gun fires twice: two separate payoffs for the same setup.", emblem: "gun" },
  { id: "tight-ship", title: "Tight Ship", text: "Every payoff in your story was set up first. No twists out of nowhere.", emblem: "star" },
  // About the writer
  { id: "opening-night", title: "Opening Night", text: "You analysed your first story of your own.", emblem: "curtain" },
  { id: "encore", title: "Encore", text: "You analysed a second story of your own.", emblem: "curtain" },
  { id: "marathon", title: "Marathon", text: "You analysed a story of 10,000 words or more.", emblem: "quill" },
  { id: "intermission", title: "Intermission", text: "You stepped out during an analysis and came back to a finished report.", emblem: "moon" },
  { id: "night-owl", title: "Night Owl", text: "You analysed a story between midnight and 4 am.", emblem: "moon" },
  { id: "script-doctor", title: "Script Doctor", text: "You overruled the tool: a gun it said never fires, you showed does.", emblem: "quill" },
  { id: "red-herring", title: "Red Herring", text: "You set aside a gun that was never meant to fire.", emblem: "quill" },
  { id: "case-closed", title: "Case Closed", text: "You set aside a red herring in The Stopped Clock.", emblem: "star" },
  { id: "sharp-eye", title: "Sharp Eye", text: "You added a gun the tool missed.", emblem: "star" },
  { id: "pinpoint", title: "Pinpoint", text: "You pointed to the exact line where a gun fires.", emblem: "quill" },
  // Secret
  { id: "six-chambers", title: "Six Chambers", text: "You found the gun's secret. Six clicks, one bang.", emblem: "gun" },
];

export const achievement = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

/** A literal gun, as in Chekhov's own example. */
export const FIREARM = /\b(gun|pistol|rifle|revolver|musket|shotgun|carbine|firearm)s?\b/i;

/** The Stopped Clock's two deliberate red herrings, recognised by their lines. */
const HERRING = /bookmakers|Alipore/i;

/** Achievements the story itself earns, after the writer's calls. */
export function storyAchievements(result: AnalysisResult, overrides: Overrides): string[] {
  const out: string[] = [];
  const c = summaryCounts(result, overrides);
  const first = result.chapters[0]?.index;
  const last = result.chapters.at(-1)?.index;
  const payoffChapter = new Map(result.payoffs.map((p) => [p.id, p.chapter]));
  // Every chapter each setup fires in: the tool's links plus the writer's calls.
  const firesIn = new Map<string, number[]>();
  for (const m of result.matches) {
    const ch = payoffChapter.get(m.payoffId);
    if (ch !== undefined) firesIn.set(m.setupId, [...(firesIn.get(m.setupId) ?? []), ch]);
  }
  for (const [id, o] of Object.entries(overrides)) {
    if (o.kind === "fired") firesIn.set(id, [...(firesIn.get(id) ?? []), o.chapter]);
  }
  const fired = (id: string) => firesIn.has(id);

  if (c.planted > 0 && c.neverFired === 0 && c.uncertain === 0) out.push("chekhov-approves");
  if (result.setups.some((s) => s.chapter === first && fired(s.id) && FIREARM.test(`${s.quote} ${s.summary}`))) {
    out.push("the-original");
  }
  if (
    result.chapters.length > 1 &&
    result.setups.some((s) => s.chapter === first && (firesIn.get(s.id) ?? []).includes(last ?? -1))
  ) {
    out.push("long-fuse");
  }
  if (result.setups.some((s) => (firesIn.get(s.id) ?? []).includes(s.chapter))) out.push("same-scene");
  if (result.setups.filter((s) => !isWriterGun(s.id)).length >= 10) out.push("full-house");
  if (result.setups.some((s) => s.kind === "promise" && fired(s.id))) out.push("promise-kept");
  if (result.setups.some((s) => result.matches.filter((m) => m.setupId === s.id).length >= 2)) out.push("double-tap");
  const linked = new Set(result.matches.map((m) => m.payoffId));
  if (result.payoffs.length > 0 && result.payoffs.every((p) => linked.has(p.id))) out.push("tight-ship");
  return out;
}

/** Achievements earned by the writer's own calls on this report. */
export function callAchievements(result: AnalysisResult, overrides: Overrides): string[] {
  const out: string[] = [];
  const calls = Object.entries(overrides);
  if (calls.some(([, o]) => o.kind === "fired")) out.push("script-doctor");
  if (calls.some(([, o]) => o.kind === "dismissed")) out.push("red-herring");
  if (calls.some(([, o]) => o.kind === "fired" && o.start !== undefined)) out.push("pinpoint");
  if (result.setups.some((s) => isWriterGun(s.id))) out.push("sharp-eye");
  const herrings = result.setups.filter((s) => HERRING.test(s.quote));
  if (herrings.some((s) => overrides[s.id]?.kind === "dismissed")) out.push("case-closed");
  return out;
}
