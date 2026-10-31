"use client";

import { useEffect, useState } from "react";
import GunGlyph from "@/components/effects/GunGlyph";
import { curtainOpened } from "@/components/effects/OpeningCurtain";

export interface Reward {
  /** Stable per story and reward, so a reward pops up once per visit. */
  key: string;
  /** A word or two. */
  title: string;
  /** Why it was unlocked. */
  text: string;
  emblem: "gun" | "curtain";
}

/** The achievement's emblem: a gold-framed tile, like a game badge. */
function Emblem({ kind }: { kind: Reward["emblem"] }) {
  return (
    // Fixed dark tile and gold in both themes, so it always reads as a badge.
    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-sm border-2 border-[#d6b25b] bg-[#1b1310] text-[#d6b25b] shadow-inner">
      {kind === "gun" ? (
        <GunGlyph className="h-6 w-12" />
      ) : (
        <svg viewBox="0 0 40 40" aria-hidden className="h-11 w-11">
          {/* A small proscenium: curtains drawn back, stars above. */}
          <path d="M4 8 H36 V12 Q30 16 24 12 Q20 16 16 12 Q10 16 4 12 Z" fill="currentColor" />
          <path d="M4 12 Q10 22 7 34 H4 Z M36 12 Q30 22 33 34 H36 Z" fill="currentColor" opacity="0.75" />
          <path d="M4 34 H36" stroke="currentColor" strokeWidth="2" />
          <path d="M20 17 l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z" fill="currentColor" />
          <circle cx="13" cy="24" r="1" fill="currentColor" />
          <circle cx="27" cy="24" r="1" fill="currentColor" />
        </svg>
      )}
    </span>
  );
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
          className={`${leaving ? "reward-toast-out" : "reward-toast"} flex w-[min(24rem,calc(100vw-2rem))] items-center gap-4 rounded-sm border border-line bg-surface p-3 pr-4 shadow-lg`}
        >
          <Emblem kind={reward.emblem} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-display text-xl leading-tight text-ink">{reward.title}</span>
            <span className="text-sm leading-snug text-ink-soft">{reward.text}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
