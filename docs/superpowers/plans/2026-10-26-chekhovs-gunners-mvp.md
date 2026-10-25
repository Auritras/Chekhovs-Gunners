# Chekhov's Gunners MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pre-event 50% of Chekhov's Gunners: a web app that finds setups and payoffs in a short story, links them, flags unfired guns, and shows the result as an animated arc map, tension chart, issue list and highlighted story.

**Architecture:** Next.js App Router app on Vercel. The browser reads files, splits chapters, and runs a shared pipeline (`lib/pipeline/analyze.ts`) that calls thin server routes one chapter at a time, passing a running setup ledger. All rules that can be code (quote verification, chapter order, unfired, uncertainty, tension) are pure functions with unit tests. The same pipeline runs in a Node script for metrics.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind, Zod v4, `@google/genai`, `mammoth`, `pdfjs-dist`, Vitest (+ `happy-dom` for browser APIs), `tsx` for scripts.

**Spec:** `docs/superpowers/specs/2026-10-26-chekhovs-gunners-mvp-design.md`

## Global Constraints

- Free only: Gemini free tier, Vercel Hobby, GitHub. No database.
- Pre-build at most 50%. Do **not** implement: verifier step, confidence scores, cheap-twist detection, fix suggestions, Gemma provider, novel-specific queueing. These are in `LIVE_SPRINT.md`.
- "It suggests; the writer decides." The app never edits the writer's text.
- `GEMINI_API_KEY` (prod, Vercel only) and `GEMINI_API_KEY_DEV` (local only). Model name from `GEMINI_MODEL`. `.env.example` committed; `.env*.local` git-ignored.
- Server routes: `GEMINI_API_KEY_DEV` is used when `NODE_ENV !== "production"` and it is set; otherwise `GEMINI_API_KEY`.
- Prompt-check and sample-builder scripts use **only** `GEMINI_API_KEY_DEV` and exit with an error if it is missing.
- Invalid model JSON: retry up to 2 times (3 attempts), then the chapter fails.
- No chapter headings → split into ~1,500-word parts and tell the user. Text over 25,000 words → warning, still runs.
- Daily-quota copy, exactly: "Today's free AI quota is used up. Here's the sample analysis instead."
- Failed-chapter banner copy, exactly: "Chapter {k} couldn't be analysed — some results may be wrong." with a "Retry chapter {k}" button.
- Per-minute 429 progress copy, exactly: "waiting for Gemini…"
- Every route handler exports `maxDuration` (60, confirmed ≤ Vercel's current Hobby limit when deploying).
- Server input limits: chapter text ≤ 60,000 characters; ledger ≤ 400 entries; match input ≤ 400 setups and 400 payoffs; best-effort limiter 30 requests/minute per IP per instance.
- Built-in sample results are static files in `public/samples/`, not cache entries, so they work with any key or model.
- Respect `prefers-reduced-motion` for all animation.

## Review Focus

1. **Quotes that differ only in typography** (curly vs straight quotes, em-dash vs `--`, line breaks inside the quote) must still verify. Test in Task 3.
2. **A chapter that fails mid-run followed by a rate limit** must still finish, mark only that chapter failed, and keep earlier chapters cached so "Retry" costs nothing for them. Test in Task 6.
3. **Text with a single "Chapter 1" heading and a preface before it** must keep the preface as its own chapter rather than dropping it. Test in Task 2.
4. **Model returns `firesSetupId` for an id not in the ledger, or for a setup in a later chapter.** The link must be dropped, not crash or appear on the map. Test in Task 4.
5. **Overlapping highlights in the Story tab** (a setup quote inside a payoff quote, or two identical quotes) must render without duplicating or losing text. Test in Task 9.

---

## File Structure

```
app/
  layout.tsx, page.tsx, globals.css
  api/extract/route.ts      POST chapter + ledger → extraction
  api/match/route.ts        POST leftovers → candidate matches
  api/meta/route.ts         GET model + prompt versions (for cache keys)
components/
  InputPanel.tsx            paste box, file upload, sample picker, Analyse button
  RunStatus.tsx             progress, warnings, failed-chapter banner, quota message
  report/Summary.tsx, report/ArcMap.tsx, report/TensionChart.tsx, report/IssueList.tsx
  story/StoryView.tsx
  ResultTabs.tsx
lib/
  types.ts                  shared domain types
  input/readFile.ts         File → text
  chapterize.ts             text → Chapter[]
  analysis/verifyQuotes.ts  quote normalisation + verification
  analysis/resolve.ts       valid matches, unfired, uncertainty
  analysis/tension.ts       per-chapter tension
  ledger.ts                 ledger building + hashing
  cache.ts                  cache keys + localStorage / file stores
  ai/schemas.ts             Zod schemas for model output and API bodies
  ai/prompts.ts             prompt builders + versions
  ai/provider.ts            ModelProvider, GeminiProvider, error classes
  server/limiter.ts         best-effort limiter
  pipeline/analyze.ts       orchestration shared by browser and scripts
  pipeline/httpDeps.ts      browser deps (fetch to /api/*)
  view/arcLayout.ts         arc map geometry
  view/highlight.ts         Story tab segments
scripts/
  lib/nodeDeps.ts           script deps (direct provider + file cache)
  prompt-check.ts           metrics against answer keys
  build-sample-results.ts   writes public/samples/<slug>/result.json
samples/<slug>/answer-key.json
public/samples/index.json, public/samples/<slug>/story.md, result.json
tests/…                     mirrors lib/
```

---

### Task 1: Scaffold, shared types and schemas

**Files:**
- Create: Next.js app at repo root (keep existing `LICENSE`, `README.md`, `docs/`), `vitest.config.ts`, `.env.example`, `lib/types.ts`, `lib/ai/schemas.ts`
- Test: `tests/ai/schemas.test.ts`

**Interfaces:**
- Produces (`lib/types.ts`):
  ```ts
  type SetupKind = "object"|"trait"|"secret"|"promise"|"skill"|"relationship"|"other";
  interface Chapter { index: number; title: string; text: string }   // index is 1-based
  interface Setup { id: string; chapter: number; quote: string; start: number; kind: SetupKind; summary: string; importance: 1|2|3 }
  interface Payoff { id: string; chapter: number; quote: string; start: number; summary: string; firesSetupId?: string }
  interface LedgerEntry { id: string; chapter: number; kind: SetupKind; summary: string }
  interface Match { setupId: string; payoffId: string; reasoning: string; source: "extract"|"match" }
  interface AnalysisResult { chapters: Chapter[]; setups: Setup[]; payoffs: Payoff[]; matches: Match[];
    unfired: string[]; tension: number[]; failedChapters: number[]; uncertain: string[]; droppedQuotes: number;
    model: string; promptVersions: { extract: string; match: string } }
  ```
  `start` is the character offset of the quote in the chapter text, filled in by code (Task 3), never by the model.
- Produces (`lib/ai/schemas.ts`): `RawExtraction` (model output: `{ setups: {quote, kind, summary, importance}[], payoffs: {quote, summary, firesSetupId: string|null}[] }`), `RawMatches` (`{ matches: {setupId, payoffId, reasoning}[] }`), `ExtractRequest` (`{ chapter: Chapter, ledger: LedgerEntry[] }`), `MatchRequest` (`{ setups: LedgerEntry[], payoffs: {id, chapter, summary, quote}[] }`), with the size limits from Global Constraints.

- [ ] **Step 1: Scaffold.** `create-next-app` refuses non-empty folders containing `README.md`, so run `npx create-next-app@latest tmp-app --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm`, move its contents into the repo root (keep our `README.md`), delete `tmp-app`. Install `zod @google/genai mammoth pdfjs-dist` and dev deps `vitest happy-dom tsx docx`. Add scripts `"test": "vitest run"`, `"prompt-check": "tsx scripts/prompt-check.ts"`, `"build-samples": "tsx scripts/build-sample-results.ts"`. `vitest.config.ts` uses the `@` alias and `environment: "node"` (browser tests opt in with `// @vitest-environment happy-dom`). `.env.example` lists `GEMINI_API_KEY=`, `GEMINI_API_KEY_DEV=`, `GEMINI_MODEL=`. Confirm `.gitignore` contains `.env*.local`.

- [ ] **Step 2: Write the failing test** `tests/ai/schemas.test.ts`:
  - `RawExtraction` accepts a valid object and rejects `importance: 4` and `kind: "weapon"`.
  - `ExtractRequest` rejects a chapter whose text is 60,001 characters and a ledger of 401 entries.
  - `MatchRequest` rejects 401 setups.

- [ ] **Step 3: Run** `npx vitest run tests/ai/schemas.test.ts` → FAIL (module not found).
- [ ] **Step 4: Implement** `lib/types.ts` and `lib/ai/schemas.ts` as above.
- [ ] **Step 5: Run** `npx vitest run` → PASS; `npm run build` → succeeds.
- [ ] **Step 6: Commit** `chore: scaffold Next.js app with shared types and schemas`.

---

### Task 2: Chapter splitting

**Files:** Create `lib/chapterize.ts`; Test `tests/chapterize.test.ts`

**Interfaces:**
- Produces: `chapterize(text: string): { chapters: Chapter[]; autoSplit: boolean; wordCount: number }`

Headings recognised on their own line: `Chapter <n|word|roman>` (case-insensitive, optional `:`/`.`/title after), Markdown `#`/`##` headings, a line of only `***` or `* * *`, and a bare roman numeral (`I`, `II`, … `XL`). Text before the first heading becomes a chapter titled "Opening" if it has ≥ 50 words, else it is prepended to the first chapter. With no headings, split into parts of ~1,500 words at the nearest paragraph break, titled "Part 1", "Part 2", … and set `autoSplit: true`. Indices are 1-based. Empty chapters are dropped.

- [ ] **Step 1: Write failing tests:**
  - `"Chapter 1\nA.\n\nChapter 2\nB."` → 2 chapters, titles `"Chapter 1"`, `"Chapter 2"`, texts `"A."`, `"B."`.
  - `# One` / `# Two` markdown headings → 2 chapters.
  - `***` separators → 3 chapters from 3 sections.
  - Review Focus 3: a 60-word preface then `Chapter 1` → 2 chapters, first titled `"Opening"`; a 10-word preface → 1 chapter containing the preface.
  - 4,000 words with no headings → `autoSplit === true`, 3 parts, no paragraph split mid-way, `wordCount === 4000`.
  - `"CHAPTER TWELVE: The Drawer"` is a heading.
- [ ] **Step 2: Run** `npx vitest run tests/chapterize.test.ts` → FAIL.
- [ ] **Step 3: Implement** `chapterize`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: split stories into chapters`.

---

### Task 3: Quote verification

**Files:** Create `lib/analysis/verifyQuotes.ts`; Test `tests/analysis/verifyQuotes.test.ts`

**Interfaces:**
- Produces: `normalise(s: string): string` and
  `verifyQuotes<T extends { quote: string }>(items: T[], chapterText: string): { kept: (T & { start: number })[]; dropped: number }`

`normalise` maps curly quotes to straight, `—`/`–` and `--` to `-`, removes spaces around `-`, `…` to `...`, collapses all whitespace to one space, trims, lowercases. To find `start`, search the normalised quote in the normalised chapter and map the index back to the original text (keep an index map while normalising). Quotes shorter than 8 normalised characters are dropped (too ambiguous).

- [ ] **Step 1: Write failing tests:**
  - Exact quote kept with correct `start`.
  - Review Focus 1: chapter contains `“Don’t open\nit—ever.”` (curly quotes, em-dash, line break). Quotes `"Don't open it - ever."`, `"Don't open it-ever."` and `"don't open it--ever"` are all **kept**, and `start` points at the `D` in the original text.
  - Invented quote → dropped, `dropped === 1`.
  - Quote `"Yes."` (too short) → dropped.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: verify model quotes against chapter text`.

---

### Task 4: Resolve matches, unfired guns, uncertainty and tension

**Files:** Create `lib/analysis/resolve.ts`, `lib/analysis/tension.ts`; Test `tests/analysis/resolve.test.ts`, `tests/analysis/tension.test.ts`

**Interfaces:**
- Produces:
  - `resolveMatches(setups: Setup[], payoffs: Payoff[], candidates: Match[]): Match[]` — keeps a candidate only if both ids exist, the payoff's chapter is later than the setup's (or equal with `payoff.start > setup.start`), and the payoff is not already linked (first valid candidate wins; one setup may have several payoffs).
  - `matchesFromExtraction(payoffs: Payoff[]): Match[]` — one `source: "extract"` match per payoff with `firesSetupId`, `reasoning: ""`.
  - `findUnfired(setups: Setup[], matches: Match[]): string[]`
  - `findUnlinkedPayoffs(payoffs: Payoff[], matches: Match[]): string[]`
  - `markUncertain(setups, payoffs, matches, failedChapters: number[]): string[]` — unfired setup with any failed chapter > its chapter; unlinked payoff with any failed chapter < its chapter.
  - `computeTension(chapterCount: number, setups: Setup[], payoffs: Payoff[], matches: Match[]): number[]` — for chapter n: sum of `importance` of setups with `chapter ≤ n` that have no match whose payoff chapter ≤ n.

- [ ] **Step 1: Write failing tests:**
  - Review Focus 4: candidate with unknown `setupId` → dropped; payoff in ch 2 for setup in ch 4 → dropped; same-chapter with payoff before setup → dropped; same-chapter after → kept.
  - A payoff matched twice → only the first kept. A setup with two payoffs → both kept.
  - `findUnfired` returns setups with no match.
  - Uncertainty: chapters 1–5, chapter 3 failed. Unfired setup in ch 2 → uncertain; unfired setup in ch 4 → not uncertain; unlinked payoff in ch 5 → uncertain; unlinked payoff in ch 2 → not uncertain. No failed chapters → `[]`.
  - Tension: setup A (ch 1, importance 3) fires in ch 3; setup B (ch 2, importance 1) never fires; 4 chapters → `[3, 4, 1, 1]`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: resolve matches, unfired guns, uncertainty and tension`.

---

### Task 5: Ledger and cache

**Files:** Create `lib/ledger.ts`, `lib/cache.ts`; Test `tests/ledger.test.ts`, `tests/cache.test.ts`

**Interfaces:**
- Produces:
  - `toLedger(setups: Setup[]): LedgerEntry[]` — ordered by chapter then `start`; summary truncated to 160 chars.
  - `sha256Hex(s: string): Promise<string>` — Web Crypto `crypto.subtle` (available in browsers and Node ≥ 20).
  - `extractCacheKey(chapterText, ledger: LedgerEntry[], promptVersion, model): Promise<string>` — `sha256Hex(chapterText + "\u0000" + sha256Hex(JSON.stringify(ledger)) + "\u0000" + promptVersion + "\u0000" + model)`, prefixed `"cg:x:"`.
  - `matchCacheKey(body: MatchRequest, promptVersion, model): Promise<string>`, prefixed `"cg:m:"`.
  - `interface CacheStore { get(key: string): Promise<unknown | undefined>; set(key: string, value: unknown): Promise<void> }`
  - `localStorageCache(): CacheStore` — JSON in `localStorage`; every access wrapped in try/catch (missing or full storage behaves as a miss / no-op).
  - `memoryCache(): CacheStore` (tests).

- [ ] **Step 1: Write failing tests:**
  - `toLedger` order and truncation.
  - Same inputs → same key; changing chapter text, any ledger entry, prompt version or model → different key.
  - `// @vitest-environment happy-dom`: `localStorageCache` round-trips a value; when `localStorage.setItem` throws, `set` resolves and `get` returns `undefined`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: setup ledger and per-chapter cache keys`.

---

### Task 6: Analysis pipeline

**Files:** Create `lib/pipeline/analyze.ts`; Test `tests/pipeline/analyze.test.ts`

**Interfaces:**
- Consumes: Tasks 3–5.
- Produces:
  ```ts
  class RateLimitedError extends Error { retryAfterMs: number }
  class QuotaExhaustedError extends Error {}
  class ChapterFailedError extends Error {}
  interface PipelineDeps {
    meta(): Promise<{ model: string; promptVersions: { extract: string; match: string } }>;
    extract(req: ExtractRequest): Promise<RawExtraction>;
    match(req: MatchRequest): Promise<RawMatches>;
    cache: CacheStore;
    sleep(ms: number): Promise<void>;
  }
  type Progress =
    | { stage: "extract"; chapter: number; of: number }
    | { stage: "waiting"; retryInMs: number }          // UI shows "waiting for Gemini…"
    | { stage: "match" } | { stage: "done" };
  type AnalyzeOutcome = { status: "ok"; result: AnalysisResult } | { status: "quota_exhausted"; partial: AnalysisResult };
  function analyze(chapters: Chapter[], deps: PipelineDeps, onProgress?: (p: Progress) => void): Promise<AnalyzeOutcome>
  ```
  Error classes live in `lib/pipeline/errors.ts` so the provider (Task 7) can import them without importing the pipeline.

Behaviour, in order:
1. For each chapter in order: build ledger from verified setups so far; look up `extractCacheKey`; on miss call `deps.extract`. On `RateLimitedError` emit `waiting`, `sleep(retryAfterMs)`, retry (max 5 waits per chapter, then the chapter fails). On `ChapterFailedError` mark failed and continue with the ledger unchanged. On `QuotaExhaustedError` stop and return `quota_exhausted` with what exists so far. Successful extractions only are cached.
2. Assign ids `c{n}-s{i}` / `c{n}-p{i}`, run `verifyQuotes` separately on setups and payoffs, add drops to `droppedQuotes`.
3. `candidates = matchesFromExtraction(payoffs)`; `matches = resolveMatches(...)`.
4. If there are unfired setups and unlinked payoffs, call match (cached the same way, same rate-limit handling; a failed match pass leaves matches as they are), tag `source: "match"`, and `resolveMatches` over all candidates again.
5. Compute `unfired`, `uncertain`, `tension`.

- [ ] **Step 1: Write failing tests** with fake deps (`memoryCache`, `sleep` that records calls):
  - Chapter 2's extraction receives a ledger containing chapter 1's verified setups (and not ones whose quotes failed verification).
  - A payoff with `firesSetupId` of a ch-1 setup produces a match with `source: "extract"`; match pass is not called when nothing is left over.
  - Second `analyze` on the same chapters makes zero `extract` calls.
  - Review Focus 2: chapter 2 throws `ChapterFailedError`, chapter 3 throws `RateLimitedError(1000)` once then succeeds → `failedChapters === [2]`, `sleep` called with 1000, a `waiting` progress emitted, chapter 3 present. Running `analyze` again with chapter 2 now succeeding (and returning one setup) calls `extract` only for chapters 2 and 3 (chapter 1 cached; chapter 3 re-runs because its ledger changed).
  - `QuotaExhaustedError` on chapter 3 → `status: "quota_exhausted"`, partial contains chapters 1–2 results.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: sequential analysis pipeline with ledger, cache and retries`.

---

### Task 7: Gemini provider and prompts

**Files:** Create `lib/ai/provider.ts`, `lib/ai/prompts.ts`; Test `tests/ai/provider.test.ts`

**Interfaces:**
- Consumes: schemas (Task 1), error classes (Task 6).
- Produces:
  - `interface ModelProvider { readonly model: string; generateJson<T>(prompt: string, schema: z.ZodType<T>): Promise<T> }`
  - `class GeminiProvider implements ModelProvider { constructor(opts: { apiKey: string; model: string; client?: GenAiLike }) }` — calls `models.generateContent` with `responseMimeType: "application/json"` and the JSON schema from `z.toJSONSchema(schema)` (check the current `@google/genai` docs for the exact config field). Parse + `schema.parse`; on parse/validation failure retry, up to 3 attempts total, then throw `ChapterFailedError`.
  - `classifyGeminiError(err: unknown): RateLimitedError | QuotaExhaustedError | Error` — HTTP 429 whose details mention a per-day quota (`PerDay` in the quota id, or "per day") → `QuotaExhaustedError`; other 429 → `RateLimitedError` using the server's `retryDelay` if present, else 15,000 ms.
  - `providerFromEnv(): ModelProvider` — key per Global Constraints; model from `GEMINI_MODEL`; throws a clear error if the key is missing.
  - `EXTRACT_PROMPT_VERSION`, `MATCH_PROMPT_VERSION` (start at `"x1"` / `"m1"`; bump on every prompt edit), `buildExtractPrompt(req: ExtractRequest): string`, `buildMatchPrompt(req: MatchRequest): string`.

Prompt requirements (wording is the implementer's): extraction asks for setups (things planted that create an expectation) and payoffs (where an earlier expectation is fulfilled), each with a **verbatim** quote of 8–40 words copied exactly from the chapter; payoffs set `firesSetupId` only to an id from the provided ledger, else `null`; importance 3 = plot-critical, 1 = minor detail; fewer, high-confidence items beat many weak ones. The match prompt links only the given ids, explains each link in one sentence, and may return no matches.

- [ ] **Step 1: Write failing tests** with a fake `client`:
  - Valid JSON on first try → parsed object.
  - Invalid JSON twice then valid → success after 3 calls; invalid 3 times → `ChapterFailedError`.
  - `classifyGeminiError` on a 429 with `quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier"` → `QuotaExhaustedError`; on a 429 with `retryDelay: "7s"` → `RateLimitedError` with `retryAfterMs === 7000`.
  - `buildExtractPrompt` output contains every ledger id and the full chapter text.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: Gemini provider, error classification and prompts`.

---

### Task 8: API routes and limiter

**Files:** Create `lib/server/limiter.ts`, `app/api/extract/route.ts`, `app/api/match/route.ts`, `app/api/meta/route.ts`, `lib/pipeline/httpDeps.ts`; Test `tests/server/limiter.test.ts`, `tests/api/routes.test.ts`

**Interfaces:**
- Produces:
  - `createLimiter(opts: { limit: number; windowMs: number; now?: () => number }): { check(key: string): boolean }`
  - Routes: each exports `maxDuration = 60` and `runtime = "nodejs"`. Body validated with the Task 1 schemas → 400 `{ error }` on failure. Limiter (30/min per `x-forwarded-for` first IP) → 429 `{ kind: "rate_limited", retryAfterMs }`. Provider errors map to: `RateLimitedError` → 429 `{ kind: "rate_limited", retryAfterMs }`; `QuotaExhaustedError` → 429 `{ kind: "quota_exhausted" }`; `ChapterFailedError` → 502 `{ kind: "chapter_failed" }`; anything else → 500 `{ kind: "error" }`.
  - `GET /api/meta` → `{ model, promptVersions: { extract, match } }`.
  - `httpDeps(): PipelineDeps` — fetch-based; maps the JSON error kinds above back to the Task 6 error classes; `cache: localStorageCache()`; `sleep` via `setTimeout`.

- [ ] **Step 1: Write failing tests:**
  - Limiter: 30 calls pass, 31st fails, passes again after the window.
  - Route handlers called directly with `new Request(...)` and a provider injected via a module mock: invalid body → 400; provider throws `QuotaExhaustedError` → 429 `quota_exhausted`; success → 200 with the parsed extraction.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Manual check.** With `GEMINI_API_KEY_DEV` in `.env.local`, `npm run dev`, then POST a one-chapter request to `/api/extract` and confirm a JSON extraction comes back.
- [ ] **Step 6: Commit** `feat: extract, match and meta API routes`.

---

### Task 9: View helpers (arc layout and highlighting)

**Files:** Create `lib/view/arcLayout.ts`, `lib/view/highlight.ts`; Test `tests/view/arcLayout.test.ts`, `tests/view/highlight.test.ts`

**Interfaces:**
- Produces:
  - `layoutArcs(result: AnalysisResult, width: number): { chapterTicks: { chapter: number; x: number; title: string }[]; nodes: { id: string; x: number; kind: "setup"|"payoff"; state: "fired"|"unfired"|"linked"|"unlinked"; uncertain: boolean }[]; arcs: { setupId: string; payoffId: string; x1: number; x2: number; height: number }[] }` — each chapter gets an equal-width band; an item's x is its band start + `(start / chapter.text.length) × band width`; arc height grows with `x2 − x1`.
  - `highlightSegments(text: string, marks: { id: string; start: number; end: number; kind: "setup"|"payoff"; state: string }[]): { text: string; marks: string[] }[]` — splits text at every mark boundary; each segment lists the ids covering it.

- [ ] **Step 1: Write failing tests:**
  - Two chapters, width 1000: a setup at the start of ch 1 → x 0; a payoff halfway through ch 2 → x 750; one arc between them.
  - Unfired setup → `state: "unfired"`; uncertain ids carry `uncertain: true`.
  - Review Focus 5: a setup mark inside a payoff mark → 3 segments with marks `[p]`, `[p, s]`, `[p]`, and joining segment texts equals the original; two identical marks with different ids → one segment listing both.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: arc map layout and story highlighting helpers`.

---

### Task 10: Input and file reading

**Files:** Create `lib/input/readFile.ts`, `components/InputPanel.tsx`; Test `tests/input/readFile.test.ts`

**Interfaces:**
- Produces:
  - `readFile(file: File): Promise<{ text: string } | { error: "unsupported" | "no_text" | "unreadable" }>` — by extension: `.txt`/`.md` → `file.text()`; `.docx` → `mammoth.extractRawText({ arrayBuffer })`; `.pdf` → `pdfjs-dist` text items joined per page with blank lines (import pdf.js dynamically, browser only). Fewer than 20 non-space characters → `no_text` (scanned PDF case). Exceptions → `unreadable`.
  - `<InputPanel onAnalyse(text: string) />` — textarea, file input (`.txt,.md,.docx,.pdf`), sample picker from `public/samples/index.json`, word count, error messages: unsupported → "That file type isn't supported. Try .txt, .md, .docx or .pdf."; `no_text`/`unreadable` → "We couldn't read text from that file — it may be a scanned PDF. Try pasting the text instead."

- [ ] **Step 1: Write failing tests** (`// @vitest-environment happy-dom`):
  - `.txt` and `.md` return their text; `.rtf` → `unsupported`; whitespace-only `.txt` → `no_text`.
  - `.docx` built in-test with the `docx` package containing "Chapter 1" and a paragraph → text contains both.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `readFile` and `InputPanel`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Manual check** in `npm run dev`: upload a real `.pdf` exported from Word → text appears; upload a scanned/image PDF → the paste message appears.
- [ ] **Step 6: Commit** `feat: paste and file upload input`.

---

### Task 11: Main page, run status and results UI

Load the `frontend-design` skill before this task.

**Files:** Create `components/RunStatus.tsx`, `components/ResultTabs.tsx`, `components/report/{Summary,ArcMap,TensionChart,IssueList}.tsx`, `components/story/StoryView.tsx`; Modify `app/page.tsx`, `app/layout.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: `chapterize`, `analyze` + `httpDeps`, `layoutArcs`, `highlightSegments`.
- Page state machine: `idle → running(progress) → done(result) | quota(partial)`; Analyse calls `chapterize` then `analyze`. Retry = call `analyze` again with the same chapters (cache makes earlier chapters free).

Content requirements:
- **RunStatus:** "Analysing chapter n of N", "waiting for Gemini…" during waits, auto-split notice ("No chapter headings found, so we split the story into parts of about 1,500 words."), >25,000-word warning, one failed-chapter banner per failed chapter with the exact copy and Retry button, and on quota the exact copy plus a "Load sample analysis" button that fetches `public/samples/<first>/result.json`.
- **Summary:** counts of setups, fired, unfired, and "uncertain" (only shown when > 0).
- **ArcMap:** SVG from `layoutArcs`; arcs draw in with a stroke-dashoffset animation; unfired setups show a short red dangling line; uncertain items dashed grey; hover/focus on a node shows its quote; keyboard focusable nodes; no animation under `prefers-reduced-motion`.
- **TensionChart:** one bar per chapter from `result.tension`, labelled by chapter title.
- **IssueList:** each unfired gun with chapter, kind, importance, summary and quote; uncertain ones labelled "may be affected by a failed chapter"; clicking one switches to the Story tab and scrolls to the quote.
- **StoryView:** chapters with `highlightSegments`; setups and payoffs styled differently, unfired setups distinct; read-only.
- **ResultTabs:** "Report" and "Story" tabs.
- Layout works at 375 px width.

- [ ] **Step 1: Implement** the components and page.
- [ ] **Step 2: Run** `npx vitest run` → PASS; `npm run build` → succeeds.
- [ ] **Step 3: Manual check** with the dev key: run a 3–5 chapter story end to end; confirm tabs, arc animation, tension bars, issue click-through, and mobile width in the browser pane. Temporarily make `/api/extract` return 502 for chapter 2 → banner appears, uncertain items are dashed, Retry re-runs only from chapter 2.
- [ ] **Step 4: Commit** `feat: report and story views`.

---

### Task 12: Samples, answer keys and metrics scripts

**Files:** Create `scripts/lib/nodeDeps.ts`, `scripts/build-sample-results.ts`, `scripts/prompt-check.ts`, `lib/metrics.ts`, `samples/the-locked-drawer/answer-key.json`, `public/samples/index.json`, `public/samples/the-locked-drawer/story.md`; Test `tests/metrics.test.ts`

**Interfaces:**
- Answer key format:
  ```ts
  interface AnswerKey { setups: { id: string; chapter: number; quoteHint: string; payoffChapter: number | null }[] }
  ```
- Produces:
  - `scoreRun(result: AnalysisResult, key: AnswerKey): { recall: number; wrongSetups: number; wrongMatches: number; unfiredCorrect: number; unfiredTotal: number; dropRate: number }` — a found setup hits a key setup when chapters are equal and the normalised quote and `quoteHint` overlap (one contains the other, or they share ≥ 6 consecutive words). `wrongSetups` = found setups hitting no key entry; `wrongMatches` = matches whose payoff chapter ≠ the key's `payoffChapter`; `dropRate` = `droppedQuotes / (droppedQuotes + setups + payoffs)`.
  - `nodeDeps(): PipelineDeps` — `GeminiProvider` with `GEMINI_API_KEY_DEV` only (exit 1 with a clear message if missing), calls prompt builders directly, file cache in `.cache/` (git-ignored), real `sleep`.
  - `npm run prompt-check [-- --runs 5]` — for each sample with an answer key, run the pipeline N times (default 5) with the cache **bypassed for extraction** so runs are independent, print a Markdown table of averages plus date, model and prompt versions.
  - `npm run build-samples` — runs each sample once and writes `public/samples/<slug>/result.json`.

- [ ] **Step 1: Write failing tests** for `scoreRun`: a result finding 3 of 4 key setups plus 1 extra → `recall 0.75`, `wrongSetups 1`; a key unfired setup that is in `unfired` → counted correct.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `lib/metrics.ts` and the scripts.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Write a placeholder sample** "The Locked Drawer" (4 chapters, ~2,000 words) with 5 planted setups: 4 that fire, 1 that never fires, plus its answer key. The team's story writer replaces or adds samples later; scripts pick up every folder automatically.
- [ ] **Step 6: Run** `npm run build-samples` then `npm run prompt-check -- --runs 2` with the dev key → table prints; `result.json` exists and loads in the app's sample picker.
- [ ] **Step 7: Commit** `feat: sample stories, answer keys and prompt-check metrics`.

---

### Task 13: Docs, deploy and end-to-end check

Load `superpowers:verification-before-completion` before this task.

**Files:** Modify `README.md`; Create `LIVE_SPRINT.md`

- [ ] **Step 1: Write `README.md`:** what it does (one paragraph, using "It suggests; the writer decides."), a Mermaid architecture diagram of browser → routes → Gemini with the ledger loop, local setup (`npm install`, `.env.local` with `GEMINI_API_KEY_DEV` and `GEMINI_MODEL`, `npm run dev`), scripts, the latest prompt-check table with date/model/prompt versions, the prompt freeze (no prompt changes 17–19 Nov 2026), live link and demo-video placeholders, and the 50/50 note pointing at `LIVE_SPRINT.md`.
- [ ] **Step 2: Write `LIVE_SPRINT.md`** listing the live-sprint features from spec §2 with one line each on the planned approach.
- [ ] **Step 3: Deploy.** The user connects the GitHub repo to Vercel and sets `GEMINI_API_KEY` (prod project) and `GEMINI_MODEL`. Confirm `maxDuration = 60` is within the Hobby limit shown in Vercel's current docs.
- [ ] **Step 4: End-to-end check on the deployed URL:** load sample (instant, no API calls in the network log), paste a new story and run it, upload a `.docx`, check mobile width.
- [ ] **Step 5: Commit** `docs: README, architecture and live sprint list`.

The `pre-event-50` tag is created at submission time (before 16 Nov), not in this plan.
