# Live sprint plan (21 Nov 2026)

Everything below is deliberately **not** in the pre-built MVP. It will be built live during the 6-hour sprint; git history is the evidence.

| Feature | Planned approach |
| --- | --- |
| Verifier step with confidence score | A second model pass re-reads each proposed match with both quotes and returns keep/reject plus a 0-1 confidence; low-confidence links are shown as uncertain. |
| Cheap-twist detection | Flag payoffs with no setup (a resolution that comes from nowhere) using the existing unlinked-payoff list, then have the model judge whether it was foreshadowed in the text. |
| Fix suggestions in the author's style | For each unfired gun or cheap twist, propose a short rewrite or added line, prompted with samples of the author's own prose; shown with accept / reject. |
| Accept / reject updates Story tab and export | Accepted changes are applied to the in-browser text only on the writer's click, re-highlighting the Story tab and enabling export; nothing is applied automatically. |
| Optional: Gemma 4 local "privacy mode" | Add a second `ModelProvider` implementation that calls a local Gemma 4 endpoint so text never leaves the machine. |
| Optional: full-novel support | Longer progress reporting and a rate-limit-aware request queue across many chapters, reusing the compact ledger. |
| Deep prompt tuning with before/after metrics | Iterate on the extract and match prompts live, running `npm run prompt-check` before and after each change and publishing both tables. |
