"use client";

import { useEffect, useRef, useState } from "react";

/**
 * An open book while the story is read: finished chapters pile up on the left page, and
 * each time a chapter is done the right-hand page turns over. Decorative; the footlights
 * and the text beside it carry the progress.
 */
export default function PageBook({ current, of, finished }: { current: number; of: number; finished: boolean }) {
  const done = finished ? of : current - 1;
  // A page turns each time the count of finished chapters goes up (not on the first draw).
  const [turns, setTurns] = useState<number[]>([]);
  const last = useRef(done);
  useEffect(() => {
    if (done > last.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const added = Array.from({ length: done - last.current }, (_, i) => last.current + i + 1);
      // Deferred: a state change in reply to new props, not during render.
      const id = setTimeout(() => setTurns((t) => [...t, ...added]), 0);
      last.current = done;
      return () => clearTimeout(id);
    }
    last.current = done;
  }, [done]);

  // The left page thickens a little with each finished chapter.
  const pile = Math.min(4, done);
  return (
    <div aria-hidden className="page-book relative h-[4.5rem] w-32 shrink-0 [perspective:600px]">
      {/* Pages already read, stacked under the left page. */}
      {Array.from({ length: pile }, (_, i) => (
        <span key={i} className="absolute inset-y-0 left-0 w-1/2 rounded-l-sm border border-line bg-surface" style={{ transform: `translate(${-(i + 1) * 1.5}px, ${(i + 1) * 1.5}px)` }} />
      ))}
      <span className="page-lines absolute inset-y-0 left-0 w-1/2 rounded-l-sm border border-line bg-surface" />
      <span className={`page-lines absolute inset-y-0 right-0 w-1/2 rounded-r-sm border border-line bg-surface ${finished ? "" : "page-read"}`} />
      {/* The spine. */}
      <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
      {turns.map((n) => (
        <span
          key={n}
          className="page-turn page-lines absolute inset-y-0 left-1/2 w-1/2 rounded-r-sm border border-line bg-surface"
          onAnimationEnd={() => setTurns((t) => t.filter((x) => x !== n))}
        />
      ))}
    </div>
  );
}
