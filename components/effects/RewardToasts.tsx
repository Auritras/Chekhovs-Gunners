"use client";

import { useEffect, useState } from "react";
import GunGlyph from "@/components/effects/GunGlyph";
import { curtainOpened } from "@/components/effects/OpeningCurtain";

export interface Reward {
  /** Stable per story and reward, so a reward pops up once per visit. */
  key: string;
  title: string;
  text: string;
}

const SHOW_MS = 6000;
const LEAVE_MS = 400;
/** Rewards already shown this visit (survives the report remounting on tab switches). */
const shown = new Set<string>();

/**
 * Achievement-style pop-ups in the bottom-right corner when the writer earns a reward:
 * a small card that slides up, holds for a few seconds, and slides back down.
 */
export default function RewardToasts({ rewards }: { rewards: Reward[] }) {
  const [open, setOpen] = useState<{ reward: Reward; leaving: boolean }[]>([]);
  const keys = rewards.map((r) => r.key).join("|");

  useEffect(() => {
    const fresh = rewards.filter((r) => !shown.has(r.key));
    if (fresh.length === 0) return;
    fresh.forEach((r) => shown.add(r.key));
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const isFresh = (r: Reward) => fresh.includes(r);
    // After the opening curtain, if one is playing, so the pop-up is seen.
    void curtainOpened().then(() => {
      if (cancelled) return;
      setOpen((o) => [...o, ...fresh.map((reward) => ({ reward, leaving: false }))]);
      timers.push(
        setTimeout(() => setOpen((o) => o.map((t) => (isFresh(t.reward) ? { ...t, leaving: true } : t))), SHOW_MS),
        setTimeout(() => setOpen((o) => o.filter((t) => !isFresh(t.reward))), SHOW_MS + LEAVE_MS),
      );
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // `keys` stands for `rewards`, which is a new array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  if (open.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed z-40 flex flex-col items-end gap-2"
      style={{
        right: "max(1rem, env(safe-area-inset-right, 0px))",
        bottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      {open.map(({ reward, leaving }) => (
        <div
          key={reward.key}
          role="status"
          className={`${leaving ? "reward-toast-out" : "reward-toast"} flex w-[min(19rem,calc(100vw-2rem))] items-center gap-3 rounded-sm border border-brass/60 bg-surface p-2 pr-3 shadow-lg`}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-ink text-brass">
            <GunGlyph className="h-4 w-8" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[0.65rem] uppercase tracking-[0.16em] text-muted">Achievement unlocked</span>
            <span className="truncate font-display text-base leading-tight text-ink">{reward.title}</span>
            <span className="truncate text-xs text-ink-soft" title={reward.text}>
              {reward.text}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
