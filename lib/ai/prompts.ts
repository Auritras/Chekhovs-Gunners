import type { ExtractRequest, MatchRequest } from "@/lib/ai/schemas";

/** Bump on every prompt edit: it is part of the cache key. */
export const EXTRACT_PROMPT_VERSION = "x2";
export const MATCH_PROMPT_VERSION = "m2";

/** Collapse whitespace so a quote or summary stays on its one line in a one-item-per-line list. */
export function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function buildExtractPrompt(req: ExtractRequest): string {
  const { chapter, ledger } = req;
  const ledgerLines = ledger.length
    ? ledger.map((e) => `${e.id} | ${e.chapter} | ${e.kind} | ${oneLine(e.summary)}`).join("\n")
    : "(empty: no setups have been recorded yet)";

  return `You are a careful literary editor analysing a story for "Chekhov's guns": narrative setups that create an expectation, and the payoffs that later fulfil them.

You are reading chapter ${chapter.index}, titled "${chapter.title}".

## Definitions
- SETUP: something planted in this chapter that creates an expectation the story should later honour. A prop given emphasis, a skill or trait shown, a secret hinted at, a promise or threat made, a relationship tension established.
- PAYOFF: a passage in this chapter where an earlier expectation is fulfilled (the prop is used, the secret revealed, the promise kept or broken, the skill saves the day).

## Setup kinds
object, trait, secret, promise, skill, relationship, other.

## Ledger: setups already found in earlier chapters
Format: id | chapter | kind | summary
${ledgerLines}

If a passage in THIS chapter fulfils a ledger setup, report it as a payoff and set "firesSetupId" to that exact ledger id. Use only ids from the ledger above, copied exactly. Never invent ids.

A payoff may also fulfil a setup planted EARLIER IN THIS SAME CHAPTER: report both the setup and the later payoff, and say in the payoff's "summary" which setup it fulfils. Such setups have no ledger id yet, so set "firesSetupId" to null; they are linked in a later step. Set "firesSetupId" to null for any payoff that does not fulfil a ledger setup.

## Rules for quotes
- Every item needs a "quote": 8 to 40 words copied EXACTLY, character for character, from the chapter text below.
- No ellipses, no paraphrase, no fixing of typos or punctuation, no joining separate passages. One contiguous stretch of text.
- Choose the quote that best shows the setup or the payoff itself.

## Importance (setups only)
- 3 = plot-critical: the story would change meaningfully if it were removed, and readers will expect it to matter.
- 2 = significant: noticeable and likely to be used again.
- 1 = minor detail: colour or texture that only might matter.

## Quality bar
Fewer, high-confidence items beat many weak ones. Skip ordinary scenery, generic description and routine actions. Report a setup only if the text gives it deliberate emphasis. Report a payoff only if it clearly fulfils an earlier expectation. An empty list is a valid answer. Each "summary" is one short sentence in your own words.

## Output
Return JSON with "setups" (quote, kind, summary, importance) and "payoffs" (quote, summary, firesSetupId).

## Chapter text
<<<CHAPTER_START>>>
${chapter.text}
<<<CHAPTER_END>>>`;
}

export function buildMatchPrompt(req: MatchRequest): string {
  const setupLines = req.setups.length
    ? req.setups
        .map(
          (s) =>
            `${s.id} | chapter ${s.chapter} | ${s.kind} | ${oneLine(s.summary)} | "${oneLine(s.quote)}"`,
        )
        .join("\n")
    : "(none)";
  const payoffLines = req.payoffs.length
    ? req.payoffs
        .map((p) => `${p.id} | chapter ${p.chapter} | ${oneLine(p.summary)} | "${oneLine(p.quote)}"`)
        .join("\n")
    : "(none)";

  return `You are a careful literary editor. Below are setups (planted expectations) and payoffs (moments of fulfilment) found in a story. Decide which payoffs fulfil which setups.

## Setups
Format: id | chapter | kind | summary | quote
${setupLines}

## Payoffs
Format: id | chapter | summary | quote
${payoffLines}

## Rules
- Link only ids listed above, copied exactly. Never invent ids.
- A payoff may only fulfil a setup from an earlier chapter or the same chapter: the setup's chapter number must be lower than or equal to the payoff's.
- Within the same chapter, the payoff must come AFTER the setup in the text. Use the two quotes to judge the order; if you cannot tell that the payoff comes later, do not link them.
- Only link when the payoff clearly fulfils that specific setup. Weak or speculative links are worse than none.
- A payoff fulfils at most one setup; a setup may have several payoffs.
- For each link give "reasoning": one sentence explaining why the payoff fulfils the setup.
- Returning an empty "matches" list is fine.

## Output
Return JSON: { "matches": [ { "setupId", "payoffId", "reasoning" } ] }`;
}
