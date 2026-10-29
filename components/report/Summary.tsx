import CountUp from "@/components/effects/CountUp";
import type { AnalysisResult } from "@/lib/types";
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

export default function Summary({ result }: { result: AnalysisResult }) {
  // planted = fired + never fired + uncertain + in the ending (uncertain counts setups only).
  const c = summaryCounts(result);

  const items: { label: string; value: number; tone?: string; href?: string }[] = [
    {
      label: c.planted === 1 ? "setup planted" : "setups planted",
      value: c.planted,
      href: c.planted > 0 ? "#arc-map" : undefined,
    },
    { label: "fired", value: c.fired, tone: "text-brass", href: c.fired > 0 ? "#fired" : undefined },
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
            </dt>
            <dd className={`order-1 font-display text-6xl leading-none tabular-nums ${it.tone ?? ""}`}>
              {it.href ? (
                <a href={it.href} onClick={(e) => jump(e, it.href!)} aria-hidden tabIndex={-1} className="hover:opacity-80">
                  <CountUp value={it.value} delay={i * 180} />
                </a>
              ) : (
                <CountUp value={it.value} delay={i * 180} />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
