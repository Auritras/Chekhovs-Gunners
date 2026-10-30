"use client";

import { useEffect } from "react";

/** The curtains hold for a beat, then part; the overlay is gone by TOTAL_MS whatever happens. */
const HOLD_MS = 300;
const PART_MS = 1000;
const TOTAL_MS = HOLD_MS + PART_MS + 100;

let opensAt = 0;

/** Call when the curtain starts: anything that should be seen (the count-up) waits for it. */
export function markCurtainStart() {
  opensAt = performance.now() + HOLD_MS + PART_MS * 0.6;
}

/** Milliseconds until the opening curtain is mostly open (0 if none is playing). */
export function curtainDelay(): number {
  return Math.max(0, opensAt - performance.now());
}

/** Full-screen stage curtains that part to reveal the first report of the visit. */
export default function OpeningCurtain({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const done = setTimeout(onDone, TOTAL_MS);
    const skip = () => onDone();
    window.addEventListener("keydown", skip);
    return () => {
      clearTimeout(done);
      window.removeEventListener("keydown", skip);
    };
  }, [onDone]);

  return (
    <div aria-hidden className="opening-curtain" onClick={onDone}>
      <div className="opening-half opening-left">
        <div className="curtain h-full w-full" />
      </div>
      <div className="opening-half opening-right">
        <div className="curtain h-full w-full" />
      </div>
    </div>
  );
}
