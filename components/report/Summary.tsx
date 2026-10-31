import CountUp from "@/components/effects/CountUp";
import type { AnalysisResult } from "@/lib/types";
import type { Overrides } from "@/lib/view/overrides";
import { summaryCounts } from "@/lib/view/summaryCounts";

/** Jump to a report section; a collapsed list (<details>) opens on arrival. */
function jump(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  const el = document.getElementById(href.slice(1));
  if (!el) return;
  e.preventDefault();
  if (el instanceof HTMLDetailsElement) el.open = true;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/** A real gun (the literal kind) in chapter 1 that fires later: Chekhov's own example. */
const FIREARM = /\b(gun|pistol|rifle|revolver|musket|shotgun|carbine|firearm)s?\b/i;

export default function Summary({ result, overrides }: { result: AnalysisResult; overrides: Overrides }) {
  // planted = fired + never fired + uncertain + in the ending + set aside (uncertain counts setups only).
  const c = summaryCounts(result, overrides);
  const allFired = c.planted > 0 && c.neverFired === 0 && c.uncertain === 0;
  const firstChapter = result.chapters[0]?.index;
  const firedIds = new Set([
    ...result.matches.map((m) => m.setupId),
    ...Object.entries(overrides)
      .filter(([, o]) => o.kind === "fired")
      .map(([id]) => id),
  ]);
  const original = result.setups.find(
    (s) => s.chapter === firstChapter && firedIds.has(s.id) && FIREARM.test(`${s.quote} ${s.summary}`),
  );

  const items: { label: string; value: number; tone?: string; href?: string; note?: string }[] = [
    {
      label: c.planted === 1 ? "setup planted" : "setups planted",
      value: c.planted,
      href: c.planted > 0 ? "#arc-map" : undefined,
    },
    {
      label: "fired",
      value: c.fired,
      tone: "text-brass",
      href: c.fired > 0 ? "#fired" : undefined,
      note: c.firedByWriter > 0 ? `${c.firedByWriter} marked by you` : undefined,
    },
    {
      label: "never fired",
      value: c.neverFired,
      tone: c.neverFired > 0 ? "text-curtain" : undefined,
      href: c.neverFired > 0 ? "#issues" : undefined,
    },
  ];
  if (c.uncertain > 0) {
    items.push({ label: "uncertain", value: c.uncertain, tone: "text-muted" });
  }
  if (c.inEnding > 0) {
    items.push({ label: "in the ending", value: c.inEnding, tone: "text-muted" });
  }
  if (c.setAside > 0) {
    items.push({ label: "set aside by you", value: c.setAside, tone: "text-muted", href: "#set-aside" });
  }

  return (
    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="sr-only">
        Summary
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:gap-0 sm:divide-x sm:divide-line">
        {items.map((it, i) => (
          <div key={it.label} className="flex flex-col sm:px-8 sm:first:pl-0">
            <dt className="order-2 mt-1 text-sm text-ink-soft">
              {it.href ? (
                <a
                  href={it.href}
                  onClick={(e) => jump(e, it.href!)}
                  className="underline decoration-line decoration-1 underline-offset-4 transition-colors hover:text-ink hover:decoration-current"
                >
                  {it.label} <span aria-hidden>↓</span>
                </a>
              ) : (
                it.label
              )}
              {it.note && <span className="block text-xs text-muted">{it.note}</span>}
            </dt>
            <dd className={`order-1 font-display text-6xl leading-none tabular-nums transition-colors duration-700 ${it.tone ?? ""}`}>
              {it.href ? (
                <a href={it.href} onClick={(e) => jump(e, it.href!)} aria-hidden tabIndex={-1} className="hover:opacity-80">
                  <CountUp value={it.value} delay={i * 400} />
                </a>
              ) : (
                <CountUp value={it.value} delay={i * 400} />
              )}
            </dd>
          </div>
        ))}
      </dl>
      {(allFired || original) && (
        <div className="mt-5 flex flex-col gap-2">
          {allFired && (
            <p className="report-reward font-display text-xl italic text-brass">
              Every gun fired. Chekhov would approve.
            </p>
          )}
          {original && (
            <p className="report-reward flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <span className="rounded-full border border-brass px-2.5 py-0.5 font-display text-base text-brass">
                The original
              </span>
              A real gun on the wall in chapter 1, and it goes off: “{original.summary}”
            </p>
          )}
        </div>
      )}
    </section>
  );
}
