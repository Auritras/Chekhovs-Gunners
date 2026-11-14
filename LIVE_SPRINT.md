# Live sprint plan (21 Nov 2026)

Everything below is deliberately **not** in the pre-built MVP. It will be built live during the 6-hour sprint; git history is the evidence (everything after the `pre-event-50` tag).

## Headline: genre-aware analysis, powered by Adaption

**Why:** our clearest measured weakness is genre. In *The Stopped Clock* (a detective story) the deliberate red herrings are flagged as loose ends, when in a mystery they are meant to stay unfired. A romance's promises and a fantasy's rules of magic need the same care.

**What the writer sees:** genre choices above the story box (Detective, Romance, Fantasy, Literary, Detect for me). In detective mode a red herring is labelled "red herring (meant to stay unfired)" instead of being flagged.

**How Adaption is used** (sponsor track "Best Use of Adaption"):

1. **Invent a Dataset** (`POST /api/v1/datasets/invent`) generates short stories in each genre. `datasets.adapt()` restructures them into story + answer-key pairs (the line that plants each gun, its kind, where it fires or that it never does, red herrings). A script writes them to `samples/<slug>/` so `prompt-check` can score them; our quote checker rejects any answer key whose quotes are not in its story. Check the cost first with `estimate=True`.
2. **Genre detection with the Adaption Responses API**: one small call with a JSON-schema function ("record_genre") picks the genre for "Detect for me". It runs on the server like the Gemini calls; the key stays in Vercel's environment variables.
3. **Genre-aware prompts**: the extract and match prompts get per-genre guidance plus one or two worked examples taken from the Adaption dataset. The genre becomes part of the cache key.
4. **Proof**: `prompt-check` per genre, before and after, with both tables in the README.

**Not planned:** AutoScientist. Its trained models come as a checkpoint to self-host, and there is no free host that can run one for the live app.

**Open questions** (ask Adaption, or find out with a two-story trial run before the day): does `invent` take free-text instructions or only preset domains and subdomains; how long can a generated story be; are Responses API inputs stored or used for training (writers' text must not be kept).

## Other live features

| Feature | Planned approach |
| --- | --- |
| "How could this fire?" | For each gun that never fires, the model suggests 2-3 places in later chapters where it could pay off, each tied to a real sentence it must quote (checked like every other quote). The writer accepts one, which becomes their call (the red thread pulls up into a gold arc at that line), or ignores them all. |
| Verifier step with confidence score | A second model pass re-reads each proposed match with both quotes and returns keep/reject plus a 0-1 confidence; low-confidence links are shown as uncertain. |
| Cheap-twist detection | Flag payoffs with no setup (a resolution that comes from nowhere) using the existing unlinked-payoff list, then have the model judge whether it was foreshadowed in the text. |
| Fix suggestions in the author's style | For each unfired gun or cheap twist, propose a short rewrite or added line, prompted with samples of the author's own prose; shown with accept / reject. |
| Accept / reject updates Story tab and export | Accepted changes are applied to the in-browser text only on the writer's click, re-highlighting the Story tab and enabling export; nothing is applied automatically. |
| Optional: Gemma 4 local "privacy mode" | Add a second `ModelProvider` implementation that calls a local Gemma 4 endpoint so text never leaves the machine. |
| Optional: full-novel support | Longer progress reporting and a rate-limit-aware request queue across many chapters, reusing the compact ledger. |
| Ending details are not setups | Teach the extract prompt that details introduced in the resolution (e.g. a deed handed over in the last scene) close the story rather than plant a gun. Today a code rule only keeps them out of the "never fired" count. |
| Deep prompt tuning with before/after metrics | Iterate on the extract and match prompts live, running `npm run prompt-check` before and after each change and publishing both tables. |

## Sprint checklist

Tick items off on the day. Order is a suggestion: the must-haves first, so there is always something to demo.

**Must have**
- [ ] Run `npm run prompt-check` for the "before" numbers
- [ ] Adaption: generate the genre benchmark and convert it into samples with answer keys
- [ ] Adaption: genre detection through the Responses API, and the genre choices in the UI
- [ ] Genre-aware prompts (red herrings in detective mode)
- [ ] "How could this fire?" suggestions for loose ends
- [ ] Cheap-twist detection
- [ ] Prompt tuning: catch the brass bell in *The Sweet Shop* and stop flagging ending details as setups
- [ ] Run `npm run prompt-check` again, per genre, for the "after" numbers; put the tables in the README

**Should have**
- [ ] Verifier step with confidence score
- [ ] Fix suggestions in the author's style
- [ ] Accept / reject updates the Story tab and export

**Nice to have**
- [ ] Gemma 4 privacy mode
- [ ] Full-novel support

**Before time runs out**
- [ ] Redeploy and check the live site
- [ ] Update the demo video / pitch with the new features
- [ ] Final push

## Ideas

Anyone on the team can add an idea here. Write one line: what it does and why a writer would want it. We pick from this list on the day if there is time.

- **"How could this fire?" (headline GenAI feature).** For each loose end, the AI suggests 2-3 places in later chapters where it could pay off, quoting the actual sentences there. The writer picks one (it becomes their call: the red thread pulls up into a gold arc at that line) or ignores them all. Real generative work on the writer's own text, shown live on stage, and it fits "It suggests; the writer decides". Measure how often writers accept a suggestion.
- **"Fire this gun" loop (demo centrepiece).** The writer accepts a suggested fix; only the affected chapters are re-checked (the cache keeps the rest free). On the arc map, the red thread rewinds and a bright gold arc draws in its place, glints once and settles, staying a shade brighter than ordinary brass arcs so the guns the writer resolved stand out.
- **Character promises as setups.** Track vows and promises ("I'll pay it back by Puja") explicitly; they are often a story's strongest guns.
- **Severity ranking.** Order the unfired guns by how much the story leans on them (importance, how often they are mentioned).
- **Implied payoffs.** Today the match step only links payoffs the text states outright. In a user test ("the cottage on the causeway"), unsigned letters to the grandmother were flagged as never firing, though the ending clearly implies the man with the "A" ring wrote them. Teach the match prompt to link strong implications too, marked as "implied" so the writer can judge. Measure with `prompt-check` like the brass-bell fix.
- **Genre selector before analysis.** The writer picks a genre (mystery, romance, fantasy, thriller, literary, or "detect for me") from a row of bubbles (pill buttons; a single-choice radio group for keyboard and screen readers, wrapping onto two lines on phones; fall back to a dropdown only if the list grows past about 8 genres) and the extract and match prompts get genre-specific guidance: in a mystery, clues and red herrings (a red herring that never fires is intentional, not a mistake); in fantasy, rules of magic or the world that must be paid off; in romance, emotional promises and relationship beats. The genre becomes part of the cache key so results don't mix. Measure it with `prompt-check` like any other prompt change.
- **Character view.** Group guns by the character who plants, holds and fires them ("Mara: 4 guns, 3 fired"), so the writer sees which characters drive the plot and which only carry props. Needs the extract prompt to name the characters involved in each setup and payoff.
- **Ask the story.** A small box under the report for questions like "Where does the compass first appear?" or "What does Tom know by chapter 3?", answered by Gemini with verified quotes from the chapter text already in the browser.
- **Live writing mode.** Paste one chapter at a time as it is written; each is analysed against the ledger so far, and the report keeps a running list of guns still on the wall. Reuses the chapter cache and ledger.
