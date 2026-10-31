import type { Metadata } from "next";
import Link from "next/link";
import { GUN_BODY, GUN_TRIGGER } from "@/components/effects/GunGlyph";

export const metadata: Metadata = { title: "Never planted · Chekhov's Gunners" };

/** 404: a gun on the wall with a red thread hanging from it, the mark of a gun that never fires. */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-20 text-center">
      <svg viewBox="0 0 120 120" aria-hidden className="h-40 w-40 text-ink">
        {/* The nail and its cord. */}
        <circle cx="60" cy="10" r="3" className="fill-brass" />
        <path d="M60 10 L40 34 M60 10 L80 34" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" fill="none" />
        <g transform="translate(22 22)">
          <path d={GUN_BODY} fill="currentColor" />
          <path d={GUN_TRIGGER} stroke="currentColor" strokeWidth="2.5" fill="none" />
        </g>
        {/* The red thread: a gun that never fires. */}
        <path
          className="never-thread"
          d="M38 70 C 40 80, 35 88, 39 98 S 36 110, 38 116"
          stroke="var(--curtain)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <div className="flex max-w-[44ch] flex-col gap-2">
        <h1 className="font-display text-4xl sm:text-5xl">This gun was never planted.</h1>
        <p className="font-serif text-lg text-ink-soft">
          There&apos;s nothing at this address. Perhaps it was cut in the edit.
        </p>
      </div>
      <Link
        href="/"
        className="min-h-11 rounded-sm bg-curtain px-6 py-2.5 font-display text-xl text-curtain-ink transition-colors hover:bg-curtain-deep"
      >
        Back to the stage
      </Link>
    </main>
  );
}
