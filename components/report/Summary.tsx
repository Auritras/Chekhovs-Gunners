import type { AnalysisResult } from "@/lib/types";

export default function Summary({ result }: { result: AnalysisResult }) {
  const fired = new Set(result.matches.map((m) => m.setupId));
  const uncertain = new Set(result.uncertain);
  const firedCount = result.setups.filter((s) => fired.has(s.id)).length;
  const unfiredCount = result.unfired.filter((id) => !uncertain.has(id)).length;

  const items: { label: string; value: number; tone?: string }[] = [
    { label: result.setups.length === 1 ? "setup planted" : "setups planted", value: result.setups.length },
    { label: "fired", value: firedCount, tone: "text-brass" },
    { label: "never fired", value: unfiredCount, tone: unfiredCount > 0 ? "text-curtain" : undefined },
  ];
  if (uncertain.size > 0) {
    items.push({ label: "uncertain", value: uncertain.size, tone: "text-muted" });
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
