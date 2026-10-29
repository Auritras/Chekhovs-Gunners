"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 700;

/** A number that counts up from 0 like a box-office counter, after `delay` ms. */
export default function CountUp({ value, delay = 0 }: { value: number; delay?: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || value === 0) {
      const id = setTimeout(() => setShown(value), 0);
      return () => clearTimeout(id);
    }
    let frame = 0;
    let begin: number | null = null;
    const tick = (now: number) => {
      begin ??= now + delay;
      const p = Math.min(1, Math.max(0, (now - begin) / DURATION_MS));
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // If animation frames are throttled (background tab, screenshots), land on the value anyway.
    const settle = setTimeout(() => setShown(value), delay + DURATION_MS + 300);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [value, delay]);

  return <>{shown}</>;
}
