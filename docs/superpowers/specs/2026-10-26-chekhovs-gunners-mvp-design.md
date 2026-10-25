# Chekhov's Gunners — MVP Design

**Date:** 2026-10-26
**Event:** GeNarrative Clash 2026 (Storytelling & Co-Writers track)
**Team:** Chekhov's Gunners (4 members)
**Status:** Draft for team review

## 1. Purpose

A writing assistant that applies **Chekhov's gun** to a story: it finds every
**setup** (a planted object, trait, secret, promise, skill or relationship),
links each one to its **payoff**, and shows which setups never fire.

**It suggests; the writer decides.** Nothing in the story changes unless the
writer explicitly accepts a change.

### Success criteria for the MVP (due 16 Nov 2026, 11:59 PM IST)

- A writer can paste or upload a short story and get back its setups, payoffs,
  matches and unfired guns, each backed by an exact quote from the text.
- On the sample stories, the prompt-check script reports recall, wrong finds and
  verifier drop rate against an answer key, and the numbers are in the README.
- The deployed app works for judges from a link with no API key or sign-up.
- The repo has a README, architecture diagram, demo video link and a clear list
  of what will be built live.

### Constraints

- **Free only:** Gemini API free tier, Vercel free tier, GitHub. No database.
- **50/50 rule:** at most 50% may be pre-built before 21 Nov 2026; the rest is
  built live in the 6-hour sprint and verified from git history.
- **Scope:** short stories and screenplay acts up to ~20,000 words. The design
  must let full novels be added later without a rewrite.

## 2. Scope split

### MVP (pre-built, submitted by 16 Nov)

- Input: paste box, plus upload of `.txt`, `.md`, `.docx`, `.pdf` (text PDFs only).
- Chapter splitting.
- AI steps: sequential per-chapter extraction with a running setup ledger;
  a match pass for anything extraction did not link.
- Quote verification and earlier-chapter rule enforced in code.
- Unfired-gun detection.
- Browser cache of results per chapter.
- Clear "quota used up" handling with fallback to the sample.
- **Report tab:** summary counts, animated arc map, per-chapter tension chart,
  issue list with quotes.
- **Story tab:** chapter text with setups and payoffs highlighted inline.
- Built-in sample stories with cached results and answer keys.
- Prompt-check script with metrics reported in the README.

### Live sprint (built on 21 Nov)

- Verifier step that re-checks each match and adds a confidence score.
- Cheap-twist detection (payoffs with no setup).
- Fix suggestions in the author's style, with accept / reject. Accepting updates
  the Story tab and export; nothing is applied without the writer's click.
- Optional: Gemma 4 local "privacy mode"; full-novel support (longer progress,
  smarter rate-limit queueing).

## 3. Architecture

Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel. AI calls run
on the server so the Gemini key is never sent to the browser.

```
Browser
 ├─ Input        paste + file upload → plain text
 ├─ Chapterizer  text → chapters[]
 ├─ Cache        localStorage, keyed per chapter (see §6)
 ├─ Runner       chapters in order: /api/extract with the ledger so far,
 │               then one /api/match for leftovers
 └─ Views
     ├─ Report tab  summary · animated arc map · tension chart · issue list
     └─ Story tab   highlighted chapter text

Server (Next.js route handlers, maxDuration set explicitly)
 ├─ POST /api/extract   { chapter, ledger } → { setups[], payoffs[] }
 └─ POST /api/match     { unmatchedSetups[], unlinkedPayoffs[] } → { matches[] }

AI layer (server only)
 ├─ ModelProvider   interface: generateJson(prompt, schema)
 │   └─ GeminiProvider  (Gemma provider added later)
 ├─ prompts/        one file per step, each with a version string
 └─ schemas/        Zod schemas for every AI response
```

### Components

| Unit | Responsibility | Depends on |
|---|---|---|
| `lib/input/readFile` | Turn `.txt/.md/.docx/.pdf` into plain text in the browser (`mammoth`, `pdfjs-dist`) | — |
| `lib/chapterize` | Split text on chapter headings (`Chapter N`, `#`, `***`, roman numerals); fall back to ~1,500-word parts | — |
| `lib/ledger` | Build the compact ledger (id, chapter, kind, short summary) from setups found so far | — |
| `lib/cache` | Hash keys and read/write per-chapter results in `localStorage` | Web Crypto |
| `lib/ai/provider` | `ModelProvider` interface and `GeminiProvider`; model chosen by env var; classifies 429s | Gemini SDK |
| `lib/ai/prompts` | Prompt text and version for extract and match | — |
| `lib/ai/schemas` | Zod schemas for `Setup`, `Payoff`, `Match` | Zod |
| `lib/analysis/verifyQuotes` | Drop setups/payoffs whose quote is not in the chapter; count drops | — |
| `lib/analysis/resolve` | Enforce earlier-chapter rule; compute unfired guns | — |
| `lib/analysis/tension` | Per-chapter tension score | — |
| `lib/server/limiter` | Best-effort in-memory request limiter and input size checks | — |
| `app/api/extract`, `app/api/match` | Validate input, call provider, validate output, retry | AI layer |
| `components/report/*` | Summary, arc map, tension chart, issue list | analysis data |
| `components/story/*` | Highlighted chapter text | analysis data |
| `scripts/prompt-check` | Run sample stories against answer keys and print metrics | AI layer |

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

interface LedgerEntry { id: string; chapter: number; kind: SetupKind; summary: string }

interface Payoff {
  id: string;
  chapter: number;
  quote: string;
  summary: string;
  firesSetupId?: string;   // set by extraction when it recognises a ledger setup
}

interface Match { setupId: string; payoffId: string; reasoning: string; source: "extract" | "match" }

interface AnalysisResult {
  chapters: Chapter[];
  setups: Setup[];
  payoffs: Payoff[];
  matches: Match[];
  unfired: string[];        // setup ids, computed in code
  tension: number[];        // one value per chapter, computed in code
  failedChapters: number[];
  uncertain: string[];      // setup/payoff ids whose status may be wrong because of a failed chapter
  droppedQuotes: number;    // removed by verifyQuotes
}
```

## 5. Data flow

1. Input is read in the browser and split into chapters.
2. **Extract, in chapter order.** For chapter *n*, `/api/extract` receives the
   chapter text and the **ledger** of setups verified in chapters 1…*n*−1. The
   model returns new setups and any payoffs, each with an exact quote. When a
   payoff fires a ledger setup, it sets `firesSetupId`.
3. **Verify quotes (code):** after normalising whitespace and quote marks, any
   item whose quote is not found in its chapter is dropped and counted. Verified
   setups are appended to the ledger before chapter *n*+1 runs.
4. **Match pass:** `/api/match` receives only setups still unmatched and payoffs
   still unlinked (not the full text) and proposes extra links with reasoning.
5. **Resolve (code):** links where the payoff is not after the setup (later
   chapter, or same chapter with the payoff quote appearing after the setup
   quote) are dropped, as are links to unknown ids. Unmatched setups become
   `unfired`.
6. **Uncertainty (code):** if any chapter failed, an unfired setup is marked
   uncertain when a failed chapter comes after it (its payoff may be there), and
   an unlinked payoff is marked uncertain when a failed chapter comes before it
   (its setup may be there).
7. **Tension (code):** for chapter *n*, the sum of `importance` of setups
   introduced in chapters ≤ *n* that have not fired by the end of chapter *n*.
8. Results render in the Report and Story tabs.

Chapters run one after another, so a 5-chapter story takes roughly 20–40
seconds; the progress bar shows which chapter is running. Full novels only add
more extract calls; the ledger stays compact (~30–50 tokens per setup).

## 6. Caching, limits and quota

- **Browser cache:** each chapter's extract result is stored in `localStorage`
  under `sha256(chapterText + ledgerHash + promptVersion + model)`. Re-running an
  unchanged story costs no quota. Editing chapter *k* re-runs chapters *k*
  onwards, because their ledger changed. Changing a prompt version invalidates
  old entries automatically. The match pass is cached the same way.
- **Server limits:** a best-effort in-memory limiter per function instance, plus
  a maximum chapter size and maximum chapters per request. This is not shared
  across instances. If abuse becomes a problem, swap in Upstash Redis
  (free tier) behind the same `limiter` interface.
- **Quota handling:** the provider classifies Gemini 429 responses.
  Per-minute limits are retried with backoff and the progress bar shows
  "waiting for Gemini…". A used-up daily quota stops the run and shows:
  "Today's free AI quota is used up. Here's the sample analysis instead,"
  with a button to load the cached sample.
- **Function time:** each route handler sets `maxDuration` explicitly, checked
  against Vercel's current Hobby limit at build time. Per-chapter requests keep
  each call well under it.

## 7. Error handling

| Case | Behaviour |
|---|---|
| Unreadable file (scanned PDF, corrupt `.docx`) | Message suggesting the writer paste the text instead |
| No chapter headings | Split into ~1,500-word parts and tell the user |
| Invalid JSON from the model | Retry up to 2 times; then mark that chapter failed and continue with the ledger unchanged |
| Any chapter failed | Banner "Chapter *k* couldn't be analysed — some results may be wrong" with a **Retry chapter *k*** button that re-runs chapter *k* onwards (earlier chapters come from the cache). Uncertain items are drawn dashed/grey on the arc map and in the issue list and counted separately in the summary |
| Per-minute rate limit (429) | Backoff and retry; progress shows "waiting for Gemini…" |
| Daily quota used up (429) | Stop, show the quota message, offer the cached sample |
| Text over ~25,000 words | Warning, analysis still runs |
| Gemini unavailable during demo | Sample stories load their cached results |

## 8. Security

- **Two Google Cloud projects, two keys, two quotas.** `GEMINI_API_KEY`
  (production project) is set only in Vercel and serves judges and visitors.
  `GEMINI_API_KEY_DEV` (development project) lives only in local `.env.local`
  and is used for local development and the prompt-check script.
  `.env.example` is committed; `.env*.local` is git-ignored.
- API routes validate request bodies with Zod and enforce size limits.

## 9. Testing and metrics

- **Unit tests (Vitest):** chapterize, ledger, cache keys, verifyQuotes,
  resolve (earlier-chapter rule, unknown ids, unfired), uncertainty marking in
  both directions, tension. No AI needed.
- **Answer keys:** each sample story ships with `answer-key.json` listing every
  planted setup, its payoff (or none), written by the story writer.
- **Prompt-check script:** uses only `GEMINI_API_KEY_DEV` and refuses to run
  without it. It caches results on disk with the same keys as the browser cache,
  so unchanged prompts cost nothing. It runs each sample story 5 times and
  reports averages for:
  - **Recall:** planted setups found / planted setups.
  - **Wrong finds:** setups and matches not in the answer key.
  - **Unfired accuracy:** planted unfired guns correctly flagged.
  - **Verifier drop rate:** quotes dropped / quotes returned.
  Run after any prompt change. The latest numbers go in the README with the
  date, model and prompt version.
- **Prompt freeze:** no prompt changes during evaluation, 17–19 Nov 2026.
- **End-to-end check:** before submission, open the deployed app and run a
  sample and an uploaded `.docx` through the full flow.

## 10. Repo deliverables for judges

- `README.md`: what it does, architecture diagram, setup steps, live link,
  demo video link, and the metrics table from the prompt-check script.
- `LIVE_SPRINT.md`: the list of features to be built on 21 Nov.
- Git tag `pre-event-50` on the commit submitted for the online round.

## 11. Team roles

- **Lead builder (Auritras):** reviews and commits code, runs the app, explains
  the architecture to judges.
- **Story writer:** writes 2–3 sample stories (4–6 chapters each, ~6 planted
  setups: 4 that fire, 1 that never fires, 1 payoff with no setup for the live
  cheap-twist feature) and their answer keys.
- **Tester:** runs real stories through the app and logs wrong results.
- **Demo and pitch:** records the demo video, makes slides, rehearses the pitch.
