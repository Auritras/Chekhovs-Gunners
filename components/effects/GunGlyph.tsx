/** The cut-paper gun (a period revolver, as on a 19th-century stage wall) used across the app. */
export const GUN_BODY =
  "M18 11.6 Q18.2 10.8 19 11 L21.3 12.4 Q21.8 12.8 21.8 13.4 V14 H27.5 V13.2 Q27.5 11.9 28.8 11.9 H43 Q44.4 11.9 44.4 13.3 V15.5 H70.8 L71.2 13.6 Q72.3 12.6 73.2 13.4 L73.6 15.5 H74.6 Q75.2 15.6 75.2 16.4 V19.8 Q75.2 20.6 74.4 20.6 H61.5 V23.2 Q61.5 24 60.7 24 H58.5 Q57.8 24 57.6 23 L57.4 22.4 H44.4 V26.6 Q44.4 28 43 28 H26.2 Q24.6 28 24.4 29.8 L25.2 45.2 Q25.3 46.6 24 46.6 H14.8 Q13.4 46.6 13.6 45.2 L18.2 17.6 Q18.4 16.2 18.3 15 Z";
/** Cylinder flutes and a grip screw, cut out of the large versions (use with fill-rule evenodd). */
export const GUN_DETAIL =
  " M31.2 16.4 H44.4 V17.4 H31.2 Z M31.2 22.8 H44.4 V23.8 H31.2 Z M17.6 38 a1.3 1.3 0 1 0 2.6 0 a1.3 1.3 0 1 0 -2.6 0 Z";
export const GUN_TRIGGER = "M27 28 V32.5 Q27 36.6 31 36.6 H34.4 Q38.2 36.6 38.2 32.5 V28 M30 28.2 Q30.4 31.4 32.2 33.4";

export default function GunGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 10 80 40" aria-hidden className={className}>
      <path d={GUN_BODY} className="fill-current" />
      <path d={GUN_TRIGGER} className="stroke-current" strokeWidth="2.5" fill="none" />
    </svg>
  );
}
