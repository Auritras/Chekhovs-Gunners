"use client";

import { useEffect, useRef } from "react";

const CLOSE_MS = 750;
const HOLD_MS = 350;
const PART_MS = 1000;
/** Only safety nets: normally each step starts when the previous animation finishes. */
const CLOSE_SAFETY_MS = CLOSE_MS + 500;
const PART_SAFETY_MS = 4000;

const EASE = "cubic-bezier(0.65, 0, 0.25, 1)";
/** Bunched at the sides, off screen: where the curtains start and end. */
const OFF_LEFT = "translateX(-100%) scaleX(0.22)";
const OFF_RIGHT = "translateX(100%) scaleX(0.22)";

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
 * Full-screen stage curtains for the first report of the visit: they sweep in from the
 * sides and close (`onClosed`: put the report in place behind them), hold for a beat once
 * the report has painted, then part (`onDone`). Driven by the Web Animations API, each step
 * starting when the last one finishes, so a slow frame cannot swallow the motion.
 */
export default function OpeningCurtain({
  onClosed,
  onDone,
}: {
  onClosed: () => void;
  onDone: () => void;
}) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;
    let cancelled = false;
    let closedOnce = false;
    const anims: Animation[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let f1 = 0;
    let f2 = 0;

    const finish = () => {
      if (cancelled) return;
      signalOpened();
      onDone();
    };

    const part = () => {
      if (cancelled) return;
      const timing: KeyframeAnimationOptions = { duration: PART_MS, easing: EASE, fill: "forwards" };
      const l = left.animate(
        [{ transform: "none" }, { transform: "scaleX(0.22)", offset: 0.6 }, { transform: OFF_LEFT }],
        timing,
      );
      const r = right.animate(
        [{ transform: "none" }, { transform: "scaleX(0.22)", offset: 0.6 }, { transform: OFF_RIGHT }],
        timing,
      );
      anims.push(l, r);
      timers.push(setTimeout(signalOpened, PART_MS * 0.5));
      r.finished.then(finish, () => {});
    };

    const closed = () => {
      if (cancelled || closedOnce) return;
      closedOnce = true;
      onClosed();
      // Hold for a beat, then wait two frames so the report behind is painted before parting.
      timers.push(
        setTimeout(() => {
          f1 = requestAnimationFrame(() => {
            f2 = requestAnimationFrame(part);
          });
        }, HOLD_MS),
        setTimeout(finish, PART_SAFETY_MS),
      );
    };

    // Close: sweep in from the sides over the page.
    const timing: KeyframeAnimationOptions = { duration: CLOSE_MS, easing: EASE, fill: "forwards" };
    const l = left.animate([{ transform: OFF_LEFT }, { transform: "none" }], timing);
    const r = right.animate([{ transform: OFF_RIGHT }, { transform: "none" }], timing);
    anims.push(l, r);
    r.finished.then(closed, () => {});
    timers.push(setTimeout(closed, CLOSE_SAFETY_MS));

    const skip = () => {
      closed();
      finish();
    };
    window.addEventListener("keydown", skip);

    return () => {
      cancelled = true;
      signalOpened();
      timers.forEach(clearTimeout);
      cancelAnimationFrame(f1);
      cancelAnimationFrame(f2);
      anims.forEach((a) => a.cancel());
      window.removeEventListener("keydown", skip);
    };
  }, [onClosed, onDone]);

  return (
    <div
      aria-hidden
      className="opening-curtain"
      onClick={() => {
        onClosed();
        onDone();
      }}
    >
      <div ref={leftRef} className="opening-half opening-left">
        <div className="curtain h-full w-full" />
      </div>
      <div ref={rightRef} className="opening-half opening-right">
        <div className="curtain h-full w-full" />
      </div>
    </div>
  );
}
