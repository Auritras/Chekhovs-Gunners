"use client";

import { useEffect, useRef } from "react";
import { isTypingOrBusy } from "@/lib/view/keys";

const KEYS: { keys: string[]; what: string }[] = [
  { keys: ["J", "K"], what: "Next or previous gun that never fires (Report cards, or the spotlight in the Story tab)" },
  { keys: ["Enter"], what: "Open the focused gun in the story" },
  { keys: ["F"], what: "It does fire: choose the chapter where it pays off" },
  { keys: ["X"], what: "Not a gun: set the focused gun aside" },
  { keys: ["←", "→"], what: "Switch between the Report and Story tabs (when a tab is focused)" },
  { keys: ["Esc"], what: "Close a dialog or cancel picking a line" },
  { keys: ["?"], what: "Show this list" },
];

/** "?" opens the list of keyboard shortcuts. */
export default function KeyboardHelp() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?" || isTypingOrBusy(e)) return;
      e.preventDefault();
      ref.current?.showModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="keys-heading"
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="programme m-auto w-[min(34rem,calc(100vw-1.5rem))] rounded-[2px] border-[5px] border-double border-brass bg-paper p-0 text-left text-ink shadow-2xl"
    >
      <div className="flex flex-col gap-4 px-5 py-5 sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <h2 id="keys-heading" className="font-display text-3xl">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close the shortcuts"
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-ink-soft transition-colors hover:text-curtain"
          >
            <svg viewBox="0 0 20 20" aria-hidden className="h-5 w-5">
              <path d="M4 4 L16 16 M16 4 L4 16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <dl className="flex flex-col">
          {KEYS.map((k) => (
            <div key={k.what} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3 border-t border-line py-2.5">
              <dt className="flex gap-1">
                {k.keys.map((key) => (
                  <kbd
                    key={key}
                    className="min-w-7 rounded-[3px] border border-ticket-edge bg-ticket px-1.5 py-0.5 text-center font-sans text-sm text-ink"
                  >
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd className="text-sm text-ink-soft">{k.what}</dd>
            </div>
          ))}
        </dl>
      </div>
    </dialog>
  );
}
