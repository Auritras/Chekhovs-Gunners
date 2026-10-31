"use client";

import { useEffect, useState } from "react";
import GunGlyph from "@/components/effects/GunGlyph";
import { curtainOpened } from "@/components/effects/OpeningCurtain";
import type { Achievement, Emblem } from "@/lib/view/achievements";
import { nextUnlocked, onUnlock } from "@/lib/view/achievementStore";

const SHOW_MS = 5000;
const LEAVE_MS = 400;

/** The achievement's emblem: a gold-framed tile, like a game badge (same in both themes). */
function EmblemTile({ kind }: { kind: Emblem }) {
  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-sm border-2 border-[#d6b25b] bg-[#1b1310] text-[#d6b25b] shadow-inner">
      {kind === "gun" ? (
        <GunGlyph className="h-6 w-12" />
      ) : (
        <svg viewBox="0 0 40 40" aria-hidden className="h-11 w-11">
          {kind === "curtain" && (
            <>
              {/* A small proscenium: curtains drawn back, a star on stage. */}
              <path d="M4 8 H36 V12 Q30 16 24 12 Q20 16 16 12 Q10 16 4 12 Z" fill="currentColor" />
              <path d="M4 12 Q10 22 7 34 H4 Z M36 12 Q30 22 33 34 H36 Z" fill="currentColor" opacity="0.75" />
              <path d="M4 34 H36" stroke="currentColor" strokeWidth="2" />
              <path d="M20 17 l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z" fill="currentColor" />
            </>
          )}
          {kind === "quill" && (
            <>
              <path d="M31 5 C20 8 12 18 10 30 L14 26 C20 24 27 16 31 5 Z" fill="currentColor" />
              <path d="M10 30 L7 35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M6 36 H32" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
            </>
          )}
          {kind === "moon" && (
            <>
              <path d="M24 6 A13 13 0 1 0 34 26 A10 10 0 1 1 24 6 Z" fill="currentColor" />
              <circle cx="11" cy="10" r="1.2" fill="currentColor" />
              <circle cx="16" cy="5" r="0.9" fill="currentColor" />
            </>
          )}
          {kind === "star" && (
            <path d="M20 5 l4.3 9.3 10.2 1.2-7.5 7 2 10.1-9-5.1-9 5.1 2-10.1-7.5-7 10.2-1.2z" fill="currentColor" />
          )}
        </svg>
      )}
    </span>
  );
}

/**
 * Achievement pop-ups in the bottom-right corner, one at a time: each slides up, holds,
 * and slides away before the next. They wait for the opening curtain if one is playing.
 */
export default function AchievementToasts() {
  const [current, setCurrent] = useState<{ a: Achievement; leaving: boolean } | null>(null);

  useEffect(() => {
    let busy = false;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const pump = () => {
      if (busy || cancelled) return;
      const a = nextUnlocked();
      if (!a) return;
      busy = true;
      void curtainOpened().then(() => {
        if (cancelled) return;
        setCurrent({ a, leaving: false });
        timers.push(
          setTimeout(() => setCurrent((c) => (c ? { ...c, leaving: true } : c)), SHOW_MS),
          setTimeout(() => {
            setCurrent(null);
            busy = false;
            pump();
          }, SHOW_MS + LEAVE_MS + 150),
        );
      });
    };
    const off = onUnlock(pump);
    pump();
    return () => {
      cancelled = true;
      off();
      timers.forEach(clearTimeout);
    };
  }, []);

  if (!current) return null;
  const { a, leaving } = current;
  return (
    <div
      className="pointer-events-none fixed z-40"
      style={{
        right: "max(1rem, env(safe-area-inset-right, 0px))",
        bottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        key={a.id}
        role="status"
        className={`${leaving ? "reward-toast-out" : "reward-toast"} flex w-[min(24rem,calc(100vw-2rem))] items-center gap-4 rounded-sm border border-line bg-surface p-3 pr-4 shadow-lg`}
      >
        <EmblemTile kind={a.emblem} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-display text-xl leading-tight text-ink">{a.title}</span>
          <span className="text-sm leading-snug text-ink-soft">{a.text}</span>
        </span>
      </div>
    </div>
  );
}
