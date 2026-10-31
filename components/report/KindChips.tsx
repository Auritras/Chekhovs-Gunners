import type { Setup, SetupKind } from "@/lib/types";

const ORDER: SetupKind[] = ["object", "secret", "skill", "relationship", "promise", "trait", "other"];
const LABEL: Record<SetupKind, string> = {
  object: "Object",
  secret: "Secret",
  skill: "Skill",
  relationship: "Relationship",
  promise: "Promise",
  trait: "Trait",
  other: "Other",
};

/** Filter the guns by type; only the types this story has are offered. */
export default function KindChips({
  setups,
  kind,
  onChange,
}: {
  setups: Setup[];
  kind: SetupKind | null;
  onChange: (kind: SetupKind | null) => void;
}) {
  const counts = new Map<SetupKind, number>();
  for (const s of setups) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
  const kinds = ORDER.filter((k) => counts.has(k));
  if (kinds.length < 2) return null;

  const chip = (selected: boolean) =>
    `min-h-11 rounded-full border px-4 text-sm transition-colors ${
      selected ? "border-brass bg-brass text-paper" : "border-line text-ink-soft hover:border-brass hover:text-ink"
    }`;
  return (
    <div role="group" aria-label="Show guns of one type" className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs uppercase tracking-[0.16em] text-muted">Show</span>
      <button type="button" aria-pressed={kind === null} onClick={() => onChange(null)} className={chip(kind === null)}>
        All
      </button>
      {kinds.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={kind === k}
          onClick={() => onChange(kind === k ? null : k)}
          className={chip(kind === k)}
        >
          {LABEL[k]} <span className="tabular-nums opacity-70">{counts.get(k)}</span>
        </button>
      ))}
    </div>
  );
}
