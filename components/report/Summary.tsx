import type { AnalysisResult } from "@/lib/types";
import { summaryCounts } from "@/lib/view/summaryCounts";

export default function Summary({ result }: { result: AnalysisResult }) {
  // planted = fired + never fired + uncertain (uncertain counts setups only).
  const c = summaryCounts(result);

  const items: { label: string; value: number; tone?: string }[] = [
    { label: c.planted === 1 ? "setup planted" : "setups planted", value: c.planted },
    { label: "fired", value: c.fired, tone: "text-brass" },
    { label: "never fired", value: c.neverFired, tone: c.neverFired > 0 ? "text-curtain" : undefined },
  ];
  if (c.uncertain > 0) {
    items.push({ label: "uncertain", value: c.uncertain, tone: "text-muted" });
  }

  return (
    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="sr-only">
        Summary
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:gap-0 sm:divide-x sm:divide-line">
        {items.map((it) => (
          <div key={it.label} className="flex flex-col sm:px-8 sm:first:pl-0">
            <dt className="order-2 mt-1 text-sm text-ink-soft">{it.label}</dt>
            <dd className={`order-1 font-display text-6xl leading-none tabular-nums ${it.tone ?? ""}`}>
              {it.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
