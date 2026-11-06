"use client";

import { useEffect, useRef, useState } from "react";
import { curtainOpened } from "@/components/effects/OpeningCurtain";

const EVENT = "cg-curtain-call";
const OFF_LEFT = "translateX(-100%) scaleX(0.22)";
const OFF_RIGHT = "translateX(100%) scaleX(0.22)";
/** Stories that have had their curtain call this visit. */
const called = new Set<string>();

/** Every gun fires: once per story per visit, after any opening curtain, take a curtain call. */
export function curtainCall(storyKey: string) {
  if (called.has(storyKey)) return;
  called.add(storyKey);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  void curtainOpened().then(() => window.dispatchEvent(new Event(EVENT)));
}

/**
 * The curtain call: the curtains sweep halfway in, a "Bravo!" between them, part again,
 * and the gun on the header wall takes a bow (PaperHeader listens for "cg-bow").
 */
export default function CurtainCall() {
  const [on, setOn] = useState(false);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const bravoRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const start = () => setOn(true);
    window.addEventListener(EVENT, start);
    return () => window.removeEventListener(EVENT, start);
  }, []);

  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    if (!on || !left || !right) return;
    const timing: KeyframeAnimationOptions = { duration: 1700, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" };
    const half = (off: string, mid: string) => [
      { transform: off },
      { transform: mid, offset: 0.38 },
      { transform: mid, offset: 0.58 },
      { transform: off },
    ];
    const anims = [
      left.animate(half(OFF_LEFT, "translateX(-52%) scaleX(0.7)"), timing),
      right.animate(half(OFF_RIGHT, "translateX(52%) scaleX(0.7)"), timing),
    ];
    const bravo = bravoRef.current?.animate(
      [{ opacity: 0, transform: "scale(0.9)" }, { opacity: 1, transform: "none", offset: 0.35 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }],
      { duration: 1700, fill: "forwards" },
    );
    if (bravo) anims.push(bravo);
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      setOn(false);
      window.dispatchEvent(new Event("cg-bow"));
    };
    anims[1].finished.then(end, () => {});
    const safety = setTimeout(end, 3000);
    return () => {
      clearTimeout(safety);
      anims.forEach((a) => a.cancel());
    };
  }, [on]);

  if (!on) return null;
  return (
    <div aria-hidden className="opening-curtain pointer-events-none">
      <div ref={leftRef} className="opening-half opening-left" style={{ transform: OFF_LEFT }}>
        <div className="curtain h-full w-full" />
      </div>
      <div ref={rightRef} className="opening-half opening-right" style={{ transform: OFF_RIGHT }}>
        <div className="curtain h-full w-full" />
      </div>
      <p
        ref={bravoRef}
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-display text-5xl italic text-gold opacity-0"
        style={{ textShadow: "0 2px 14px rgba(0,0,0,0.45)" }}
      >
        Bravo!
      </p>
    </div>
  );
}
