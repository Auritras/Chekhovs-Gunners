"use client";

import { useEffect, useState } from "react";

const KEY = "cg-theme";

/** Lights "up" is the light theme, "down" the dark one; with no choice made, the system decides. */
function currentlyUp(): boolean {
  const chosen = document.documentElement.dataset.theme;
  if (chosen) return chosen === "light";
  return !window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** The house lights: a small brass switch in the header that turns the page light or dark. */
export default function HouseLights() {
  // Unknown until mounted (the server cannot know the writer's choice or system setting).
  const [up, setUp] = useState<boolean | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setUp(currentlyUp()), 0);
    return () => clearTimeout(id);
  }, []);

  function toggle() {
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
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={up ?? undefined}
      aria-label={up === false ? "House lights down. Turn them up (light theme)" : "House lights up. Turn them down (dark theme)"}
      className="flex min-h-11 items-center gap-2 rounded-sm px-2 text-xs uppercase tracking-[0.16em] text-curtain-ink/80 transition-colors hover:text-curtain-ink"
    >
      <span>House lights</span>
      {/* A brass lever: up on the left, down on the right. */}
      <span aria-hidden className="relative h-4 w-8 rounded-full border border-[#d6b25b] bg-black/30">
        <span
          className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-[#d6b25b] shadow transition-[left] duration-300 ${
            up === false ? "left-[1.05rem]" : "left-0.5"
          }`}
        />
      </span>
      <span className="w-9 text-left">{up === null ? "" : up ? "up" : "down"}</span>
    </button>
  );
}
