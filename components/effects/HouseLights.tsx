"use client";

import { useEffect, useRef, useState } from "react";

const KEY = "cg-theme";

/** Lights "up" is the light theme, "down" the dark one; with no choice made, the system decides. */
function currentlyUp(): boolean {
  const chosen = document.documentElement.dataset.theme;
  if (chosen) return chosen === "light";
  return !window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * The house lights: a pull-cord with a brass tassel hanging from the valance. Pull it
 * (click or tap) to turn the page light or dark.
 */
export default function HouseLights() {
  // Unknown until mounted (the server cannot know the writer's choice or system setting).
  const [up, setUp] = useState<boolean | null>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const tasselRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setUp(currentlyUp()), 0);
    return () => clearTimeout(id);
  }, []);

  function pull() {
    const next = !currentlyUp();
    const theme = next ? "light" : "dark";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const switchLights = () => {
      document.documentElement.dataset.theme = theme;
      // Canvas drawings read the palette when they draw, so tell them to redraw.
      window.dispatchEvent(new Event("cg-theme"));
    };
    // The stage lights fade up or down instead of snapping (where the browser can cross-fade).
    const root = document.documentElement;
    if (!reduce && "startViewTransition" in document) {
      root.classList.add("lights-fade");
      const t = (document as Document & { startViewTransition: (cb: () => void) => { finished: Promise<void> } })
        .startViewTransition(switchLights);
      t.finished.finally(() => root.classList.remove("lights-fade"));
    } else {
      switchLights();
    }
    try {
      window.localStorage.setItem(KEY, theme);
    } catch {
      // Storage blocked: the choice lasts until the page closes.
    }
    setUp(next);
    if (reduce) return;
    // The cord stretches from where it hangs and springs back; the tassel rides on its end.
    const line = lineRef.current;
    const length = line?.offsetHeight ?? 0;
    const stretch = [1, 1.22, 0.93, 1.05, 0.99, 1];
    const timing = { duration: 750, easing: "ease-out" };
    line?.animate(stretch.map((s) => ({ transform: `scaleY(${s})` })), timing);
    tasselRef.current?.animate(
      stretch.map((s) => ({ transform: `translateY(${((s - 1) * length).toFixed(1)}px)` })),
      timing,
    );
  }

  const label = up === false ? "House lights down" : "House lights up";
  return (
    <button
      type="button"
      onClick={pull}
      aria-pressed={up ?? undefined}
      aria-label={`${label}. Pull to turn them ${up === false ? "up (light theme)" : "down (dark theme)"}`}
      className="group relative flex w-8 justify-center outline-none"
    >
      <span aria-hidden className="flex flex-col items-center">
        {/* The cord, then the brass tassel. */}
        <span ref={lineRef} className="h-[3.25rem] w-px origin-top bg-[#d6b25b]/80 sm:h-[7.5rem]" />
        <span ref={tasselRef} className="flex flex-col items-center">
          <span className="h-2 w-2 rounded-full bg-[#d6b25b]" />
          <span className="h-3 w-2.5 rounded-b-sm bg-[#d6b25b] [clip-path:polygon(25%_0,75%_0,100%_100%,0_100%)]" />
        </span>
      </span>
      <span className="pointer-events-none absolute left-full top-10 ml-1 whitespace-nowrap rounded-sm bg-black/50 px-2 py-0.5 text-xs uppercase tracking-[0.14em] text-curtain-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {label}
      </span>
    </button>
  );
}
