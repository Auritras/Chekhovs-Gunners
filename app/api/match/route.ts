import { MatchRequest, RawMatches } from "@/lib/ai/schemas";
import { buildMatchPrompt } from "@/lib/ai/prompts";
import { handleModelRoute } from "@/lib/server/handler";

export const maxDuration = 60;
export const runtime = "nodejs";

export function POST(req: Request) {
  return handleModelRoute(req, MatchRequest, RawMatches, buildMatchPrompt);
}
