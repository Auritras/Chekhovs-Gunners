import GunGlyph from "@/components/effects/GunGlyph";

export interface WallItem {
  id: string;
  chapter: number;
  summary: string;
  /** Chapter whose payoff fired it, once known. */
  firedIn?: number;
}

const SHOWN = 8;

/**
 * While a story is read: each chapter's setups are hung on the wall as they are found,
 * and a gold thread draws under one when a later payoff fires it. Real results only.
 */
export default function FoundWall({ items }: { items: WallItem[] }) {
  if (items.length === 0) return null;
  const hidden = Math.max(0, items.length - SHOWN);
  const shown = items.slice(-SHOWN);
  const fired = items.filter((i) => i.firedIn !== undefined).length;

  return (
    <section aria-label="Found so far" className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
        On the wall so far: {items.length} {items.length === 1 ? "gun" : "guns"}
        {fired > 0 && <span className="text-brass">, {fired} fired</span>}
      </p>
      {hidden > 0 && <p className="text-xs text-muted">and {hidden} earlier</p>}
      <ul className="flex flex-col gap-1.5">
        {shown.map((g) => (
          <li key={g.id} className="wall-hang flex items-baseline gap-3 text-sm">
            <GunGlyph
              className={`h-3 w-6 shrink-0 translate-y-0.5 ${g.firedIn !== undefined ? "text-brass" : "text-ink-soft"}`}
            />
            <span className="w-11 shrink-0 tabular-nums text-muted">Ch {g.chapter}</span>
            <span className="relative min-w-0">
              <span className="text-ink">{g.summary}</span>
              {g.firedIn !== undefined && (
                <>
                  <span className="wall-fired ml-2 whitespace-nowrap text-brass">fired in Ch {g.firedIn}</span>
                  <span aria-hidden className="wall-thread absolute -bottom-0.5 left-0 h-px w-full bg-brass" />
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
