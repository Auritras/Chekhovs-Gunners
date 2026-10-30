"use client";

import { useEffect, useRef } from "react";

const HOLD_MS = 300;
const PART_MS = 1000;
/** Only a safety net: normally the overlay leaves when the parting animation finishes. */
const SAFETY_MS = 4000;

let opened: Promise<void> | null = null;
let resolveOpened: (() => void) | null = null;

function signalOpened() {
  resolveOpened?.();
  resolveOpened = null;
  opened = null;
}

/** Call when the curtain is raised: anything that should be seen (the count-up) waits for it. */
export function markCurtainStart() {
  opened = new Promise((r) => (resolveOpened = r));
}

/** Resolves once the opening curtain is mostly open (immediately if none is playing). */
export function curtainOpened(): Promise<void> {
  return opened ?? Promise.resolve();
}

/**
 * Full-screen stage curtains that part to reveal the first report of the visit.
 * The parting starts only after the report behind has painted, and is driven by the
 * Web Animations API, so a slow first frame cannot swallow the motion.
 */
export default function OpeningCurtain({ onDone }: { onDone: () => void }) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const anims: Animation[] = [];
    let f1 = 0;
    let f2 = 0;
    let mid: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      if (cancelled) return;
      signalOpened();
      onDone();
    };

    const part = () => {
      const left = leftRef.current;
      const right = rightRef.current;
      if (cancelled || !left || !right) return;
      const timing: KeyframeAnimationOptions = {
        duration: PART_MS,
        easing: "cubic-bezier(0.65, 0, 0.25, 1)",
        fill: "forwards",
      };
      anims.push(
        left.animate(
          [
            { transform: "none" },
            { transform: "scaleX(0.22)", offset: 0.6 },
            { transform: "translateX(-100%) scaleX(0.22)" },
          ],
          timing,
        ),
        right.animate(
          [
            { transform: "none" },
            { transform: "scaleX(0.22)", offset: 0.6 },
            { transform: "translateX(100%) scaleX(0.22)" },
          ],
          timing,
        ),
      );
      mid = setTimeout(signalOpened, PART_MS * 0.5);
      anims[1].finished.then(finish, () => {});
    };

    // Hold for a beat, then wait two frames so the report behind is painted before moving.
    const hold = setTimeout(() => {
      f1 = requestAnimationFrame(() => {
        f2 = requestAnimationFrame(part);
      });
    }, HOLD_MS);
    const safety = setTimeout(finish, SAFETY_MS);
    const skip = () => finish();
    window.addEventListener("keydown", skip);

    return () => {
      cancelled = true;
      signalOpened();
      clearTimeout(hold);
      clearTimeout(safety);
      clearTimeout(mid);
      cancelAnimationFrame(f1);
      cancelAnimationFrame(f2);
      anims.forEach((a) => a.cancel());
      window.removeEventListener("keydown", skip);
    };
  }, [onDone]);

  return (
    <div aria-hidden className="opening-curtain" onClick={onDone}>
      <div ref={leftRef} className="opening-half opening-left">
        <div className="curtain h-full w-full" />
      </div>
      <div ref={rightRef} className="opening-half opening-right">
        <div className="curtain h-full w-full" />
      </div>
    </div>
  );
}
