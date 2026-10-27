import type { LedgerEntry } from "@/lib/types";
import type { MatchRequest } from "@/lib/ai/schemas";

export async function sha256Hex(s: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function extractCacheKey(
  chapterText: string,
  ledger: LedgerEntry[],
  promptVersion: string,
  model: string,
): Promise<string> {
  const ledgerHash = await sha256Hex(JSON.stringify(ledger));
  return "cg:x:" + (await sha256Hex([chapterText, ledgerHash, promptVersion, model].join("\u0000")));
}

export async function matchCacheKey(body: MatchRequest, promptVersion: string, model: string): Promise<string> {
  return "cg:m:" + (await sha256Hex(JSON.stringify(body) + "\u0000" + promptVersion + "\u0000" + model));
}

export interface CacheStore {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

export function localStorageCache(): CacheStore {
  return {
    async get(key) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? undefined : JSON.parse(raw);
      } catch {
        return undefined;
      }
    },
    async set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* missing or full storage: behave as a no-op */
      }
    },
  };
}

export function memoryCache(): CacheStore {
  const m = new Map<string, unknown>();
  return {
    async get(key) {
      return m.get(key);
    },
    async set(key, value) {
      m.set(key, value);
    },
  };
}
