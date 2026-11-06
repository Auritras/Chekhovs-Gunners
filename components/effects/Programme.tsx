"use client";

import { useEffect, useRef, useState } from "react";
import EmblemTile from "@/components/effects/EmblemTile";
import { ACHIEVEMENTS, type Achievement } from "@/lib/view/achievements";
import { onUnlock, unlockedIds } from "@/lib/view/achievementStore";

const GROUPS: { id: Achievement["group"]; title: string }[] = [
  { id: "story", title: "Earned by your story" },
  { id: "writer", title: "Earned by you" },
  { id: "secret", title: "Secret" },
];

/**
 * "Programme · 4 of 19": the achievements so far, opened from the footer. Locked ones are
 * dimmed and untitled; their line hints at how to earn them (a secret's stays hidden).
 */
export default function Programme() {
  // Unknown until mounted: the server cannot see what this browser has unlocked.
  const [have, setHave] = useState<Set<string> | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setHave(unlockedIds()), 0);
    const off = onUnlock(() => setHave(unlockedIds()));
    return () => {
      clearTimeout(id);
      off();
    };
  }, []);

  const count = have?.size ?? 0;
  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="min-h-11 rounded-sm text-sm text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
      >
        Programme{have && ` · ${count} of ${ACHIEVEMENTS.length}`}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="programme-heading"
        // A click on the backdrop (the dialog element itself, outside its panel) closes it.
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="programme m-auto max-h-[min(44rem,calc(100dvh-2rem))] w-[min(46rem,calc(100vw-2rem))] rounded-sm border border-line bg-paper p-0 text-left text-ink shadow-2xl"
      >
        <div className="flex flex-col gap-6 p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-muted">Chekhov&rsquo;s Gunners presents</p>
              <h2 id="programme-heading" className="font-display text-3xl">
                The programme
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                {count} of {ACHIEVEMENTS.length} achievements, kept in this browser.
              </p>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="min-h-11 rounded-sm border border-line px-3 text-sm text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              Close
            </button>
          </div>
          {GROUPS.map((g) => (
            <section key={g.id} aria-label={g.title} className="flex flex-col gap-3">
              <h3 className="border-b border-line pb-1 text-xs uppercase tracking-[0.16em] text-muted">{g.title}</h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {ACHIEVEMENTS.filter((a) => a.group === g.id).map((a) => {
                  const got = have?.has(a.id) ?? false;
                  return (
                    <li key={a.id} className="flex items-center gap-3">
                      <span className={got ? "" : "opacity-30 grayscale"}>
                        <EmblemTile kind={a.emblem} small />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className={`font-display text-lg leading-tight ${got ? "text-ink" : "text-muted"}`}>
                          {got ? a.title : "???"}
                          {!got && <span className="sr-only"> (locked)</span>}
                        </span>
                        <span className={`text-sm leading-snug ${got ? "text-ink-soft" : "text-muted"}`}>
                          {got || a.group !== "secret" ? a.text : "A secret, for the curious."}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </dialog>
    </>
  );
}
