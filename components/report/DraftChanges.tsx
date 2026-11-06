"use client";

import type { Setup } from "@/lib/types";
import type { DraftChanges as Changes } from "@/lib/view/compare";

const link =
  "text-left underline decoration-line decoration-1 underline-offset-4 transition-colors hover:text-ink hover:decoration-current";

function Group({
  title,
  tone,
  mark,
  guns,
  onSelect,
}: {
  title: string;
  tone: string;
  mark: string;
  guns: Setup[];
  onSelect?: (id: string) => void;
}) {
  if (guns.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className={`text-xs uppercase tracking-[0.16em] ${tone}`}>
        {title} · {guns.length}
      </h3>
      <ul className="flex flex-col gap-1 text-ink-soft">
        {guns.map((s) => (
          <li key={s.id} className="flex gap-2">
            <span aria-hidden className={`${tone} shrink-0`}>
              {mark}
            </span>
            <span>
              {onSelect ? (
                <button type="button" onClick={() => onSelect(s.id)} className={`min-h-11 sm:min-h-0 ${link}`}>
                  {s.summary}
                </button>
              ) : (
                s.summary
              )}{" "}
              <span className="text-xs text-muted">Ch {s.chapter}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Since your last draft": what an edit changed, shown above the report after a re-run. */
export default function DraftChanges({
  changes,
  onSelect,
  onDismiss,
}: {
  changes: Changes;
  onSelect: (setupId: string) => void;
  onDismiss: () => void;
}) {
  const { nowFires, newLoose, gone, stillLoose, since } = changes;
  const nothing = nowFires.length + newLoose.length + gone.length === 0;
  const when = new Date(since).toLocaleString(undefined, { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" });
  return (
    <section aria-labelledby="draft-changes-heading" className="rounded-sm border border-line border-l-2 border-l-gold p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="draft-changes-heading" className="font-display text-2xl text-ink">
          Since your last draft
        </h2>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-11 text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
        >
          Dismiss
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        Compared with your run of {when}. Each run reads the story afresh, so a small shift can be the
        model, not your edit.
      </p>
      {nothing ? (
        <p className="mt-4 text-ink-soft">No gun changed: the same loose ends as last time.</p>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
          <Group title="Now fires" tone="text-brass" mark="✓" guns={nowFires} onSelect={onSelect} />
          <Group title="New loose ends" tone="text-curtain" mark="●" guns={newLoose} onSelect={onSelect} />
          <Group title="No longer in the story" tone="text-muted" mark="–" guns={gone} />
        </div>
      )}
      {stillLoose > 0 && (
        <p className="mt-4 text-sm text-ink-soft">
          {stillLoose === 1 ? "1 loose end is" : `${stillLoose} loose ends are`} still waiting from last time.
        </p>
      )}
    </section>
  );
}
