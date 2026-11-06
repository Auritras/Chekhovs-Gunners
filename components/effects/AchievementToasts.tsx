"use client";

import { useEffect, useState } from "react";
import EmblemTile from "@/components/effects/EmblemTile";
import { curtainOpened } from "@/components/effects/OpeningCurtain";
import { ACHIEVEMENTS, type Achievement } from "@/lib/view/achievements";
import { nextUnlocked, onUnlock } from "@/lib/view/achievementStore";

const SHOW_MS = 5000;
/** The stub tears off first, then the ticket slides away. */
const LEAVE_MS = 650;

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
      <div key={a.id} role="status" className="flex w-[min(25rem,calc(100vw-2rem))] items-stretch drop-shadow-lg">
        {/* An admission ticket: the body, then a stub behind a perforation that tears off as it leaves. */}
        <div
          className={`${leaving ? "reward-toast-out" : "reward-toast"} flex min-w-0 flex-1 items-center gap-4 rounded-l-[3px] border border-r-0 border-ticket-edge bg-ticket p-3 pr-4`}
        >
          <EmblemTile kind={a.emblem} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[0.65rem] font-medium uppercase tracking-[0.25em] text-curtain">Admit one</span>
            <span className="font-display text-xl leading-tight text-ink">{a.title}</span>
            <span className="text-sm leading-snug text-ink-soft">{a.text}</span>
          </span>
        </div>
        <div
          aria-hidden
          className={`${leaving ? "toast-stub-tear" : "reward-toast"} flex w-9 shrink-0 items-center justify-center rounded-r-[3px] border-y border-l-2 border-r border-ticket-edge bg-ticket [border-left-style:dashed]`}
        >
          <span className="font-display text-xs tracking-[0.15em] text-ink-soft [writing-mode:vertical-rl]">
            No. {String(ACHIEVEMENTS.findIndex((x) => x.id === a.id) + 1).padStart(2, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}
