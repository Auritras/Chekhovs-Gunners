import { ExtractRequest, RawExtraction } from "@/lib/ai/schemas";
import { buildExtractPrompt } from "@/lib/ai/prompts";
import { handleModelRoute } from "@/lib/server/handler";

export const maxDuration = 60;
export const runtime = "nodejs";

export function POST(req: Request) {
  return handleModelRoute(req, ExtractRequest, RawExtraction, buildExtractPrompt);
}
