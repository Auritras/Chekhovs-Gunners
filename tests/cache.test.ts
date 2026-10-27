// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { extractCacheKey, matchCacheKey, sha256Hex, localStorageCache, memoryCache } from "@/lib/cache";
import type { LedgerEntry } from "@/lib/types";

const ledger: LedgerEntry[] = [
  { id: "a", chapter: 1, kind: "object", summary: "a gun" },
  { id: "b", chapter: 2, kind: "trait", summary: "fear" },
];

describe("keys", () => {
  it("sha256Hex is lowercase hex", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("extract key is stable and sensitive to every input", async () => {
    const k = await extractCacheKey("text", ledger, "v1", "m");
    expect(k.startsWith("cg:x:")).toBe(true);
    expect(await extractCacheKey("text", ledger, "v1", "m")).toBe(k);
    expect(await extractCacheKey("text2", ledger, "v1", "m")).not.toBe(k);
    expect(await extractCacheKey("text", [ledger[0], { ...ledger[1], summary: "fear!" }], "v1", "m")).not.toBe(k);
    expect(await extractCacheKey("text", ledger, "v2", "m")).not.toBe(k);
    expect(await extractCacheKey("text", ledger, "v1", "m2")).not.toBe(k);
  });
  it("match key is stable and sensitive", async () => {
    const setups = ledger.map((e) => ({ ...e, quote: `quote ${e.id}` }));
    const body = { setups, payoffs: [{ id: "p", chapter: 3, summary: "s", quote: "q" }] };
    const k = await matchCacheKey(body, "v1", "m");
    expect(k.startsWith("cg:m:")).toBe(true);
    expect(await matchCacheKey(body, "v1", "m")).toBe(k);
    expect(await matchCacheKey({ ...body, payoffs: [] }, "v1", "m")).not.toBe(k);
    const requoted = [setups[0], { ...setups[1], quote: "other" }];
    expect(await matchCacheKey({ ...body, setups: requoted }, "v1", "m")).not.toBe(k);
    expect(await matchCacheKey(body, "v2", "m")).not.toBe(k);
    expect(await matchCacheKey(body, "v1", "m2")).not.toBe(k);
  });
});

describe("stores", () => {
  it("memoryCache round-trips", async () => {
    const c = memoryCache();
    expect(await c.get("k")).toBeUndefined();
    await c.set("k", { a: 1 });
    expect(await c.get("k")).toEqual({ a: 1 });
  });
  it("localStorageCache round-trips", async () => {
    const c = localStorageCache();
    await c.set("cg:x:1", { a: [1, 2] });
    expect(await c.get("cg:x:1")).toEqual({ a: [1, 2] });
    expect(await c.get("missing")).toBeUndefined();
  });
  it("treats corrupt JSON as a miss", async () => {
    localStorage.setItem("bad", "{nope");
    expect(await localStorageCache().get("bad")).toBeUndefined();
  });
  it("survives a throwing localStorage", async () => {
    const c = localStorageCache();
    const set = vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("full"); });
    await expect(c.set("never-stored", 1)).resolves.toBeUndefined();
    expect(await c.get("never-stored")).toBeUndefined();
    set.mockRestore();
  });
});
