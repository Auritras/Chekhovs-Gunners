export type SetupKind =
  | "object"
  | "trait"
  | "secret"
  | "promise"
  | "skill"
  | "relationship"
  | "other";

/** `index` is 1-based. */
export interface Chapter {
  index: number;
  title: string;
  text: string;
}

/** `start` is the character offset of `quote` in the chapter text, set by code, never by the model. */
export interface Setup {
  id: string;
  chapter: number;
  quote: string;
  start: number;
  kind: SetupKind;
  summary: string;
  importance: 1 | 2 | 3;
}

export interface Payoff {
  id: string;
  chapter: number;
  quote: string;
  start: number;
  summary: string;
  firesSetupId?: string;
}

export interface LedgerEntry {
  id: string;
  chapter: number;
  kind: SetupKind;
  summary: string;
}

export interface Match {
  setupId: string;
  payoffId: string;
  reasoning: string;
  source: "extract" | "match";
}

export interface AnalysisResult {
  chapters: Chapter[];
  setups: Setup[];
  payoffs: Payoff[];
  matches: Match[];
  unfired: string[];
  tension: number[];
  failedChapters: number[];
  uncertain: string[];
  droppedQuotes: number;
  model: string;
  promptVersions: { extract: string; match: string };
}
