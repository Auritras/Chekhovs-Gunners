# Design prompt

Use this prompt when asking an AI to polish or add UI to Chekhov's Gunners.

```text
You are polishing Chekhov's Gunners, a Next.js app that finds setups and payoffs in fiction.
Keep its existing design: the playhouse palette in app/globals.css (paper, ink, curtain, brass, muted)
and its three fonts (IM Fell English for display, Literata for story text, Instrument Sans for UI).
Do not introduce new colors, fonts, or components that don't match these.

Rules:
- Spacing on a 4px scale; no one-off values. Consistent radius and border style across cards, buttons, inputs.
- Headings use text-wrap: balance; numbers in stats and the tension chart use tabular-nums.
- WCAG AA contrast in light and dark; visible focus states; full keyboard use; 44x44px tap targets.
- Works at 375px wide with no horizontal scroll.
- Every wait (file reading, analysis per chapter) has a clear loading state; nothing shifts when results arrive.
- Motion is welcome where it tells the story (arcs drawing in, a gun "firing"), but stays short,
  never blocks input, and is replaced by stillness under prefers-reduced-motion.
- Copy is specific to writers and stories; no generic startup slogans, no emoji, no sparkles.
- Page title, meta description, favicon and OG image are set; no placeholder text or dead links.

Before finishing, check each rule above against the result and fix anything that fails.
```

## Effect studies

Four animation studies in this style (risograph playbill, paper cutout set, kinetic typography, tension landscape) were approved by the team on 29 Oct 2026. Planned uses:

- Kinetic typography: demo video opening, analysis loading screen
- Risograph playbill or paper cutout set: landing header / empty state
- Tension landscape: behind the tension chart in the report
