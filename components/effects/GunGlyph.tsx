/** The cut-paper gun used in the header and as the report's divider ornament. */
export const GUN_BODY =
  "M6 16 H70 V22 H74 V28 H34 Q30 28 29 32 L25 46 Q24 48 21 48 H12 Q9 48 10 45 L15 28 H6 Z";
export const GUN_TRIGGER = "M34 28 Q36 36 31 38";

export default function GunGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 10 80 40" aria-hidden className={className}>
      <path d={GUN_BODY} className="fill-current" />
      <path d={GUN_TRIGGER} className="stroke-current" strokeWidth="2.5" fill="none" />
    </svg>
  );
}
