import GunGlyph from "@/components/effects/GunGlyph";

const STEPS = [
  {
    title: "Plant",
    text: "We find every setup your story plants: objects, promises, secrets, skills.",
    icon: <GunGlyph className="h-5 w-10" />,
  },
  {
    title: "Track",
    text: "We carry each one forward, chapter by chapter.",
    icon: (
      <svg viewBox="0 0 40 20" className="h-5 w-10" aria-hidden>
        <path d="M2 18 A 18 15 0 0 1 38 18" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
        <circle cx="2" cy="18" r="2.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Fire",
    text: "We show where each one pays off, and flag the ones that never do.",
    icon: (
      <svg viewBox="0 0 40 20" className="h-5 w-10" aria-hidden>
        <path d="M2 18 A 18 15 0 0 1 36 18" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="2" cy="18" r="2.5" fill="currentColor" />
        <path d="M36 14 L40 18 L36 22 L32 18 Z" fill="currentColor" />
      </svg>
    ),
  },
];

/** The method in three steps, numbered because they happen in this order. */
export default function HowItWorks() {
  return (
    <ol className="grid gap-5 border-y border-line py-5 sm:grid-cols-3 sm:gap-6">
      {STEPS.map((s, i) => (
        <li key={s.title} className="flex flex-col gap-2">
          <span className="flex items-center gap-3 text-brass">
            {s.icon}
            <span className="font-display text-xl text-ink">
              <span className="text-brass tabular-nums">{i + 1}.</span> {s.title}
            </span>
          </span>
          <span className="text-sm leading-snug text-ink-soft">{s.text}</span>
        </li>
      ))}
    </ol>
  );
}
