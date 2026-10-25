# Chekhov's Gunners — MVP Design

**Date:** 2026-10-26
**Event:** GeNarrative Clash 2026 (Storytelling & Co-Writers track)
**Team:** Chekhov's Gunners (4 members)
**Status:** Draft for team review

## 1. Purpose

A writing assistant that applies **Chekhov's gun** to a story: it finds every
**setup** (a planted object, trait, secret, promise, skill or relationship),
links each one to its **payoff**, and shows which setups never fire. It helps
the writer see their structure; it never rewrites their story.

### Success criteria for the MVP (due 16 Nov 2026, 11:59 PM IST)

- A writer can paste or upload a short story and get back its setups, payoffs,
  matches and unfired guns, each backed by an exact quote from the text.
- On the built-in sample story, the app finds every planted setup and flags the
  deliberately unfired one.
- The deployed app works for judges from a link with no API key or sign-up.
- The repo has a README, architecture diagram, demo video link and a clear list
  of what will be built live.

### Constraints

- **Free only:** Gemini API free tier, Vercel free tier, GitHub.
- **50/50 rule:** at most 50% may be pre-built before 21 Nov 2026; the rest is
  built live in the 6-hour sprint and verified from git history.
- **Scope:** short stories and screenplay acts up to ~20,000 words. The design
  must let full novels be added later without a rewrite.

## 2. Scope split

### MVP (pre-built, submitted by 16 Nov)

- Input: paste box, plus upload of `.txt`, `.md`, `.docx`, `.pdf` (text PDFs only).
- Chapter splitting.
- AI steps: extract setups and payoffs per chapter; match setups to payoffs.
- Quote verification and earlier-chapter rule enforced in code.
- Unfired-gun detection.
- **Report tab:** summary counts, animated arc map, per-chapter tension chart,
  issue list with quotes.
- **Story tab:** chapter text with setups and payoffs highlighted inline.
- Built-in sample story with a cached result.

### Live sprint (built on 21 Nov)

- Verifier step that re-checks each match and adds a confidence score.
- Cheap-twist detection (payoffs with no setup).
- Fix suggestions in the author's style, with accept / reject.
- Optional: Gemma 4 local "privacy mode"; full-novel support (rate-limit
  queueing, progress for long runs).

## 3. Architecture

Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel. AI calls run
on the server so the Gemini key is never sent to the browser.

```
Browser
 ├─ Input        paste + file upload → plain text
 ├─ Chapterizer  text → chapters[]
 ├─ Runner       calls /api/extract per chapter (max 3 in parallel), then /api/match
 └─ Views
     ├─ Report tab  summary · animated arc map · tension chart · issue list
     └─ Story tab   highlighted chapter text

Server (Next.js route handlers)
 ├─ POST /api/extract   { chapter } → { setups[], payoffs[] }
 └─ POST /api/match     { setups[], payoffs[] } → { matches[] }

AI layer (server only)
 ├─ ModelProvider   interface: generateJson(prompt, schema)
 │   └─ GeminiProvider  (Gemma provider added later)
 ├─ prompts/        one file per step
 └─ schemas/        Zod schemas for every AI response
```

### Components

| Unit | Responsibility | Depends on |
|---|---|---|
| `lib/input/readFile` | Turn `.txt/.md/.docx/.pdf` into plain text in the browser (`mammoth`, `pdfjs-dist`) | — |
| `lib/chapterize` | Split text on chapter headings (`Chapter N`, `#`, `***`, roman numerals); fall back to ~1,500-word parts | — |
| `lib/ai/provider` | `ModelProvider` interface and `GeminiProvider`; model chosen by env var | Gemini SDK |
| `lib/ai/prompts` | Prompt text for extract and match | — |
| `lib/ai/schemas` | Zod schemas for `Setup`, `Payoff`, `Match` | Zod |
| `lib/analysis/verifyQuotes` | Drop setups/payoffs whose quote is not in the chapter | — |
| `lib/analysis/resolve` | Enforce earlier-chapter rule; compute unfired guns | — |
| `lib/analysis/tension` | Per-chapter tension score | — |
| `app/api/extract`, `app/api/match` | Validate input, call provider, validate output, retry | AI layer |
| `components/report/*` | Summary, arc map, tension chart, issue list | analysis data |
| `components/story/*` | Highlighted chapter text | analysis data |

## 4. Data model

```ts
type SetupKind = "object" | "trait" | "secret" | "promise" | "skill" | "relationship" | "other";

interface Chapter { index: number; title: string; text: string }

interface Setup {
  id: string;          // e.g. "c2-s1"
  chapter: number;
  quote: string;       // exact substring of the chapter text
  kind: SetupKind;
  summary: string;
  importance: 1 | 2 | 3;
}

interface Payoff { id: string; chapter: number; quote: string; summary: string }

interface Match { setupId: string; payoffId: string; reasoning: string }

interface AnalysisResult {
  chapters: Chapter[];
  setups: Setup[];
  payoffs: Payoff[];
  matches: Match[];
  unfired: string[];   // setup ids, computed in code
  tension: number[];   // one value per chapter, computed in code
  failedChapters: number[];
}
```

## 5. Data flow

1. Input is read in the browser and split into chapters.
2. **Extract:** for each chapter, `/api/extract` asks the model for setups and
   payoffs with exact quotes, using JSON output constrained by the schema.
3. **Verify quotes (code):** after normalising whitespace and quote marks, any
   item whose quote is not found in its chapter is dropped.
4. **Match:** `/api/match` receives only the verified setups and payoffs (not
   the full text) and returns matches with reasoning.
5. **Resolve (code):** matches where the payoff is not in a later chapter than
   the setup (same chapter allowed only if the payoff quote appears after the
   setup quote) are dropped. Unmatched setups become `unfired`.
6. **Tension (code):** for chapter *n*, the sum of `importance` of setups
   introduced in chapters ≤ *n* whose payoff (if any) is in a chapter > *n*.
7. Results render in the Report and Story tabs.

Because extraction is per chapter and matching works on the compact list, full
novels only change the number of extract calls.

## 6. Error handling

| Case | Behaviour |
|---|---|
| Unreadable file (scanned PDF, corrupt `.docx`) | Message suggesting the writer paste the text instead |
| No chapter headings | Split into ~1,500-word parts and tell the user |
| Invalid JSON from the model | Retry up to 2 times; then mark that chapter failed and continue |
| Rate limit (HTTP 429) | Exponential backoff; progress shows "waiting for Gemini…" |
| Text over ~25,000 words | Warning, analysis still runs |
| Gemini unavailable during demo | Sample story loads its cached result |

## 7. Security

- `GEMINI_API_KEY` lives in `.env.local` locally and in Vercel environment
  settings. `.env.example` is committed; `.env*.local` is git-ignored.
- API routes reject chapters over a size limit to protect the free quota.

## 8. Testing

- **Unit tests (Vitest):** chapterize, verifyQuotes, resolve (earlier-chapter
  rule, unfired), tension. No AI needed.
- **Prompt check script:** runs the sample story through the real API and
  asserts the planted setups are found and the unfired one is flagged. Run
  after any prompt change.
- **End-to-end check:** before submission, open the deployed app and run the
  sample and an uploaded `.docx` through the full flow.

## 9. Repo deliverables for judges

- `README.md`: what it does, architecture diagram, setup steps, live link,
  demo video link.
- `LIVE_SPRINT.md`: the list of features to be built on 21 Nov.
- Git tag `pre-event-50` on the commit submitted for the online round.

## 10. Team roles

- **Lead builder (Auritras):** reviews and commits code, runs the app, explains
  the architecture to judges.
- **Story writer:** writes the sample story (4–6 chapters, ~6 planted setups:
  4 that fire, 1 that never fires, 1 payoff with no setup for the live
  cheap-twist feature).
- **Tester:** runs real stories through the app and logs wrong results.
- **Demo and pitch:** records the demo video, makes slides, rehearses the pitch.
