import { DEFAULT_MODEL } from "@/lib/ai/provider";
import { EXTRACT_PROMPT_VERSION, MATCH_PROMPT_VERSION } from "@/lib/ai/prompts";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    promptVersions: { extract: EXTRACT_PROMPT_VERSION, match: MATCH_PROMPT_VERSION },
  });
}
