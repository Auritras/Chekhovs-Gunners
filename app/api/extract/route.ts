import { ExtractRequest, RawExtraction } from "@/lib/ai/schemas";
import { buildExtractPrompt } from "@/lib/ai/prompts";
import { handleModelRoute } from "@/lib/server/handler";

export const maxDuration = 120; // Hobby allows up to 300 s; a medium-thinking chapter takes ~27 s, up to 3 attempts
export const runtime = "nodejs";

export function POST(req: Request) {
  return handleModelRoute(req, ExtractRequest, RawExtraction, buildExtractPrompt);
}
