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
  const cordRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setUp(currentlyUp()), 0);
    return () => clearTimeout(id);
  }, []);

  function pull() {
    const next = !currentlyUp();
    const theme = next ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(KEY, theme);
    } catch {
      // Storage blocked: the choice lasts until the page closes.
    }
    // Canvas drawings read the palette when they draw, so tell them to redraw.
    window.dispatchEvent(new Event("cg-theme"));
    setUp(next);
    // A little tug on the cord.
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cordRef.current?.animate(
        [{ transform: "none" }, { transform: "translateY(8px)" }, { transform: "translateY(-2px)" }, { transform: "none" }],
        { duration: 450, easing: "ease-out" },
      );
    }
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
      <span ref={cordRef} aria-hidden className="flex flex-col items-center">
        {/* The cord, then the brass tassel. */}
        <span className="h-6 w-px bg-[#d6b25b]/80 sm:h-12" />
        <span className="h-2 w-2 rounded-full bg-[#d6b25b]" />
        <span className="h-3 w-2.5 rounded-b-sm bg-[#d6b25b] [clip-path:polygon(25%_0,75%_0,100%_100%,0_100%)]" />
      </span>
      <span className="pointer-events-none absolute left-full top-full -mt-5 whitespace-nowrap rounded-sm bg-black/50 px-2 py-0.5 text-xs uppercase tracking-[0.14em] text-curtain-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {label}
      </span>
    </button>
  );
}
