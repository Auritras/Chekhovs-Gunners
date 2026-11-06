"use client";

import { useEffect, useState } from "react";
import EmblemTile from "@/components/effects/EmblemTile";
import { curtainOpened } from "@/components/effects/OpeningCurtain";
import type { Achievement } from "@/lib/view/achievements";
import { nextUnlocked, onUnlock } from "@/lib/view/achievementStore";

const SHOW_MS = 5000;
const LEAVE_MS = 400;

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
