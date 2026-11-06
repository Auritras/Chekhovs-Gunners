import { z } from "zod";
import type { AnalysisResult } from "@/lib/types";
import type { Overrides, WriterGun } from "@/lib/view/overrides";

/**
 * Share a report as a link: the result, the writer's calls and added guns, compressed into
 * the URL fragment (after "#", which browsers never send to the server). Links are untrusted
 * input on the way back in, so they are checked strictly before anything is shown.
 */
export interface SharedReport {
  result: AnalysisResult;
  overrides: Overrides;
  guns: WriterGun[];
  title?: string;
}

const PREFIX = "r=";
/** Past this a link gets unwieldy in chats and mail, so the writer is told instead. */
export const MAX_LINK_CHARS = 120_000;

const int = z.number().int().min(0);
const Span = { start: int, end: int, quote: z.string().max(20_000) };
const Kind = z.enum(["object", "trait", "secret", "promise", "skill", "relationship", "other"]);
const Payload = z.object({
  v: z.literal(1),
  title: z.string().max(200).optional(),
  result: z.object({
    chapters: z.array(z.object({ index: int, title: z.string().max(500), text: z.string().max(200_000) })).min(1).max(400),
    setups: z.array(z.object({ id: z.string().max(100), chapter: int, ...Span, kind: Kind, summary: z.string().max(2000), importance: z.union([z.literal(1), z.literal(2), z.literal(3)]) })).max(2000),
    payoffs: z.array(z.object({ id: z.string().max(100), chapter: int, ...Span, summary: z.string().max(2000), firesSetupId: z.string().optional() })).max(2000),
    matches: z.array(z.object({ setupId: z.string(), payoffId: z.string(), reasoning: z.string().max(4000), source: z.enum(["extract", "match"]) })).max(4000),
    unfired: z.array(z.string()),
    inEnding: z.array(z.string()).optional(),
    tension: z.array(z.number()),
    failedChapters: z.array(int),
    uncertain: z.array(z.string()),
    droppedQuotes: int,
    model: z.string().max(200),
    promptVersions: z.object({ extract: z.string().max(50), match: z.string().max(50) }),
  }),
  overrides: z.record(
    z.string(),
    z.union([
      z.object({ kind: z.literal("fired"), chapter: int, start: int.optional(), end: int.optional(), quote: z.string().max(20_000).optional() }),
      z.object({ kind: z.literal("dismissed") }),
    ]),
  ),
  guns: z.array(z.object({ id: z.string().max(100), chapter: int, ...Span, summary: z.string().max(2000) })).max(500),
});

const toBase64Url = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromBase64Url = (text: string) => {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** The fragment for a report ("r=..."), without the "#". */
export async function encodeReport(report: SharedReport): Promise<string> {
  const json = JSON.stringify({ v: 1, ...report });
  const packed = await pipe(new TextEncoder().encode(json), new CompressionStream("deflate-raw"));
  return PREFIX + toBase64Url(packed);
}

/** The report in a fragment, or null if there is none or it does not check out. */
export async function decodeReport(fragment: string): Promise<SharedReport | null> {
  const text = fragment.replace(/^#/, "");
  if (!text.startsWith(PREFIX)) return null;
  try {
    const bytes = await pipe(fromBase64Url(text.slice(PREFIX.length)), new DecompressionStream("deflate-raw"));
    if (bytes.length > 8_000_000) return null;
    const parsed = Payload.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    if (!parsed.success) return null;
    const { result, overrides, guns, title } = parsed.data;
    return { result, overrides, guns, title };
  } catch {
    return null;
  }
}
