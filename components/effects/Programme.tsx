"use client";

import { useEffect, useRef, useState } from "react";
import EmblemTile from "@/components/effects/EmblemTile";
import { ACHIEVEMENTS, type Achievement } from "@/lib/view/achievements";
import { onUnlock, unlockDates, unlockedIds } from "@/lib/view/achievementStore";

const ACTS: { id: Achievement["group"]; title: string; stub: string }[] = [
  { id: "story", title: "Act I · Your story", stub: "Act I" },
  { id: "writer", title: "Act II · You", stub: "Act II" },
  { id: "secret", title: "Encore · A secret", stub: "Encore" },
];

const dateFmt = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();

/** One achievement as an admission ticket: printed when earned, a blank outline when not. */
function Ticket({ a, no, stub, at }: { a: Achievement; no: number; stub: string; at: number | null | undefined }) {
  const got = at !== null;
  const secret = !got && a.group === "secret";
  return (
    <li
      className={`ticket relative flex min-h-[5.5rem] items-stretch rounded-[3px] ${
        got ? "border border-[#c9a85a] bg-[#f6e7bf] text-[#2b2014]" : "border border-dashed border-[#b3a27e] text-[#8d7f6c]"
      }`}
    >
      <span className={`flex items-center pl-3 ${got ? "" : "opacity-35 grayscale"}`}>
        <EmblemTile kind={a.emblem} small />
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
        <span className={`text-[0.65rem] font-medium uppercase tracking-[0.25em] ${got ? "text-[#8c1c22]" : ""}`}>
          Admit one
        </span>
        <span className="font-display text-xl leading-tight">
          {got ? a.title : "? ? ?"}
          {!got && <span className="sr-only"> (not yet earned)</span>}
        </span>
        <span className="font-serif text-xs leading-snug">{secret ? "A secret, for the curious." : a.text}</span>
        <span className="mt-1 text-[0.65rem] uppercase tracking-[0.12em] text-[#7a6a55]">
          No. {String(no).padStart(2, "0")}
          {got ? (at ? ` · ${dateFmt(at)}` : " · Admitted") : " · Not yet admitted"}
        </span>
      </span>
      {/* The tear-off stub, behind a perforation. */}
      <span
        aria-hidden
        className={`flex w-8 shrink-0 items-center justify-center border-l-2 border-dashed ${
          got ? "border-[#c9a85a]" : "border-[#c9b88f]"
        }`}
      >
        <span className="font-display text-xs tracking-[0.15em] [writing-mode:vertical-rl]">{stub}</span>
      </span>
    </li>
  );
}

/**
 * The programme: every achievement as a ticket stub in a playbill. It opens from a small
 * ticket hanging from the valance (see ProgrammeTicket) and closes with Esc, Close or a
 * click outside.
 */
export default function Programme() {
  // Unknown until mounted: the server cannot see what this browser has unlocked.
  const [have, setHave] = useState<Set<string> | null>(null);
  const [dates, setDates] = useState<Record<string, number>>({});
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ticketRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const read = () => {
      setHave(unlockedIds());
      setDates(unlockDates());
    };
    const id = setTimeout(read, 0);
    const off = onUnlock(() => {
      read();
      // A new ticket: the one on the valance glints.
      const t = ticketRef.current;
      if (!t || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      t.animate(
        [{ filter: "brightness(1)" }, { filter: "brightness(1.6)" }, { filter: "brightness(1)" }],
        { duration: 900, easing: "ease-out" },
      );
    });
    return () => {
      clearTimeout(id);
      off();
    };
  }, []);

  function open() {
    dialogRef.current?.showModal();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ticketRef.current?.animate(
        [{ transform: "none" }, { transform: "translateY(6px)" }, { transform: "translateY(-2px)" }, { transform: "none" }],
        { duration: 450, easing: "ease-out" },
      );
    }
  }

  const count = have?.size ?? 0;
  const total = ACHIEVEMENTS.length;
  const label = have ? `Programme: ${count} of ${total} tickets collected` : "Programme";
  return (
    <>
      <button
        ref={ticketRef}
        type="button"
        onClick={open}
        aria-label={label}
        aria-haspopup="dialog"
        className="group relative flex w-[3.75rem] flex-col items-center outline-none sm:w-[4.75rem]"
      >
        <span aria-hidden className="ticket-sway flex flex-col items-center">
          {/* The string, then a small ticket with the count. */}
          <span className="h-7 w-px bg-[#d6b25b]/80 sm:h-[4.5rem]" />
          <svg viewBox="0 0 56 34" className="h-9 w-[3.75rem] drop-shadow-[0_2px_2px_rgba(0,0,0,0.45)] sm:h-[2.85rem] sm:w-[4.75rem]">
            <path
              d="M3 1 H53 A2 2 0 0 1 55 3 V13 A4 4 0 0 0 55 21 V31 A2 2 0 0 1 53 33 H3 A2 2 0 0 1 1 31 V21 A4 4 0 0 0 1 13 V3 A2 2 0 0 1 3 1 Z"
              fill="#efe6d2"
              stroke="#96731f"
            />
            <circle cx="28" cy="4.5" r="1.6" fill="#96731f" />
            <path d="M42 5 V29" stroke="#96731f" strokeDasharray="2 2" />
            <text x="22" y="15" textAnchor="middle" fontSize="6.5" letterSpacing="1" fill="#8c1c22" style={{ fontFamily: "var(--font-instrument), sans-serif" }}>
              ADMIT
            </text>
            <text x="22" y="27" textAnchor="middle" fontSize="10" fill="#1d1714" style={{ fontFamily: "var(--font-fell), serif" }}>
              {have ? `${count}/${total}` : "—"}
            </text>
          </svg>
        </span>
        <span className="pointer-events-none absolute right-0 top-full mt-1 whitespace-nowrap rounded-sm bg-black/50 px-2 py-0.5 text-xs uppercase tracking-[0.14em] text-curtain-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ">
          Programme
        </span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="programme-heading"
        // A click on the backdrop (the dialog element itself, outside the playbill) closes it.
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="programme m-auto max-h-[min(46rem,calc(100dvh-2rem))] w-[min(48rem,calc(100vw-1.5rem))] rounded-[2px] border-[5px] border-double border-[#96731f] bg-[#efe6d2] p-0 text-left text-[#1d1714] shadow-2xl"
      >
        <div className="flex flex-col gap-6 px-4 py-5 sm:px-8 sm:py-7">
          <div className="relative border-y-[3px] border-double border-[#96731f] py-3 text-center">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="-mt-2 ml-auto block min-h-11 rounded-sm sm:absolute sm:right-0 sm:top-1/2 sm:mt-0 sm:-translate-y-1/2 px-2 text-sm text-[#5a4f47] underline decoration-[#c9b88f] underline-offset-4 hover:text-[#1d1714]"
            >
              Close
            </button>
            <p className="text-[0.7rem] uppercase tracking-[0.28em] text-[#6b5d50]">Chekhov&rsquo;s Gunners presents</p>
            <h2 id="programme-heading" className="font-display text-4xl leading-tight">
              The Programme
            </h2>
            <p className="font-serif text-sm italic text-[#5a4f47]">
              {count} of {total} tickets collected, kept in this browser
            </p>
          </div>
          {ACTS.map((act) => (
            <section key={act.id} aria-label={act.title} className="flex flex-col gap-3">
              <h3 className="flex items-center gap-3 font-display text-sm uppercase tracking-[0.18em] text-[#8c1c22]">
                {act.title}
                <span aria-hidden className="h-px flex-1 bg-[#c9b88f]" />
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {ACHIEVEMENTS.map((a, i) => ({ a, no: i + 1 }))
                  .filter(({ a }) => a.group === act.id)
                  .map(({ a, no }) => (
                    <Ticket
                      key={a.id}
                      a={a}
                      no={no}
                      stub={act.stub}
                      at={have?.has(a.id) ? (dates[a.id] ?? undefined) : null}
                    />
                  ))}
              </ul>
            </section>
          ))}
          <p className="text-center font-serif text-xs italic text-[#6b5d50]">
            It suggests; the writer decides.
          </p>
        </div>
      </dialog>
    </>
  );
}
