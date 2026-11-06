import GunGlyph from "@/components/effects/GunGlyph";
import type { Emblem } from "@/lib/view/achievements";

/** The achievement's emblem: a gold-framed tile, like a game badge (same in both themes). */
export default function EmblemTile({ kind, small = false }: { kind: Emblem; small?: boolean }) {
  return (
    <span className={`flex ${small ? "h-12 w-12" : "h-16 w-16"} shrink-0 items-center justify-center rounded-sm border-2 border-[#d6b25b] bg-[#1b1310] text-[#d6b25b] shadow-inner`}>
      {kind === "gun" ? (
        <GunGlyph className={small ? "h-5 w-9" : "h-6 w-12"} />
      ) : (
        <svg viewBox="0 0 40 40" aria-hidden className={small ? "h-8 w-8" : "h-11 w-11"}>
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
