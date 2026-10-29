import type { CSSProperties } from "react";

const LINE = "If a gun hangs on the wall in act one, it must go off by act three.";
const WORDS = LINE.split(" ");

/** Chekhov's rule arriving word by word; "off" fires in brass. Plays once on mount. */
export default function KineticLine() {
  return (
    <p className="kinetic font-display text-xl italic leading-snug text-ink-soft sm:text-2xl" aria-label={LINE}>
      {WORDS.map((w, i) => (
        <span key={i} aria-hidden>
          <span
            className={`kinetic-word${w === "off" ? " kinetic-bang" : ""}`}
            style={{ "--i": i } as CSSProperties}
          >
            {w}
          </span>{" "}
        </span>
      ))}
    </p>
  );
}
