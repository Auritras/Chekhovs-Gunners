import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GeminiProvider, DEFAULT_MODEL } from "@/lib/ai/provider";
import {
  buildExtractPrompt,
  buildMatchPrompt,
  EXTRACT_PROMPT_VERSION,
  MATCH_PROMPT_VERSION,
} from "@/lib/ai/prompts";
import { RawExtraction, RawMatches } from "@/lib/ai/schemas";
import type { CacheStore } from "@/lib/cache";
import type { PipelineDeps } from "@/lib/pipeline/analyze";
import { chapterize } from "@/lib/chapterize";
import type { Chapter } from "@/lib/types";

const CACHE_DIR = ".cache";

export function loadEnv(): void {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
}

export function requireDevKey(): string {
  loadEnv();
  const key = process.env.GEMINI_API_KEY_DEV;
  if (!key) {
    console.error(
      "GEMINI_API_KEY_DEV is not set. Add it to .env.local (scripts use the dev key only, never GEMINI_API_KEY).",
    );
    process.exit(1);
  }
  return key;
}

/** One JSON file per key in `.cache/`; ":" in the key becomes "_" in the filename. */
export function fileCache(dir = CACHE_DIR): CacheStore {
  const file = (key: string) => join(dir, key.replace(/:/g, "_") + ".json");
  return {
    async get(key) {
      try {
        return JSON.parse(readFileSync(file(key), "utf8"));
      } catch {
        return undefined;
      }
    },
    async set(key, value) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file(key), JSON.stringify(value));
    },
  };
}

/** Pipeline deps backed by Gemini (dev key only). Pass `cache` to override the file cache. */
export function nodeDeps(cache: CacheStore = fileCache()): PipelineDeps {
  const apiKey = requireDevKey();
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const provider = new GeminiProvider({ apiKey, model, thinkingLevel: process.env.GEMINI_THINKING_LEVEL });
  return {
    async meta() {
      return {
        model,
        promptVersions: { extract: EXTRACT_PROMPT_VERSION, match: MATCH_PROMPT_VERSION },
      };
    },
    extract: (req) => provider.generateJson(buildExtractPrompt(req), RawExtraction),
    match: (req) => provider.generateJson(buildMatchPrompt(req), RawMatches),
    cache,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

export interface SampleInfo {
  slug: string;
  chapters: Chapter[];
  keyPath: string;
}

/** Samples are the folders with `samples/<slug>/answer-key.json`; stories live in `public/samples/<slug>/story.md`. */
export function listSamples(): SampleInfo[] {
  if (!existsSync("samples")) return [];
  return readdirSync("samples")
    .filter((slug) => existsSync(join("samples", slug, "answer-key.json")))
    .sort()
    .map((slug) => {
      const story = readFileSync(join("public", "samples", slug, "story.md"), "utf8");
      return { slug, chapters: chapterize(story).chapters, keyPath: join("samples", slug, "answer-key.json") };
    });
}
