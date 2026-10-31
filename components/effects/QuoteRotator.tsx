"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Entrance = "words" | "type" | "ink" | "wipe" | "stamp";

/**
 * Public-domain lines on setup and payoff, checked against their sources on 30 Oct 2026
 * (Wikipedia's rendering of Gurliand; Wikisource; eapoe.org; Project Gutenberg #3172, #1974).
 */
const QUOTES: { text: string; by: string; entrance: Entrance; bang?: string }[] = [
  {
    text: "If in the first act you have hung a pistol on the wall, then in the following one it should be fired. Otherwise don't put it there.",
    by: "Anton Chekhov, as recalled by Ilia Gurliand, 1904",
    entrance: "words",
    bang: "fired.",
  },
  {
    text: "It is only with the denouement constantly in view that we can give a plot its indispensable air of consequence, or causation.",
    by: "Edgar Allan Poe, “The Philosophy of Composition”, 1846",
    entrance: "type",
  },
  {
    text: "They require that the episodes of a tale shall be necessary parts of the tale, and shall help to develop it.",
    by: "Mark Twain, “Fenimore Cooper’s Literary Offenses”, 1895",
    entrance: "ink",
  },
  {
    text: "In the whole composition there should be no word written, of which the tendency, direct or indirect, is not to the one pre-established design.",
    by: "Edgar Allan Poe, on Hawthorne’s Twice-Told Tales, 1842",
    entrance: "wipe",
  },
  {
    text: "A whole is that which has a beginning, a middle, and an end.",
    by: "Aristotle, Poetics, tr. S. H. Butcher",
    entrance: "stamp",
  },
];

const SHOW_MS = 7000;
const OUT_MS = 400;

const TYPE_MS = 24;

/**
 * Typewriter: reveals the text itself, a letter at a time. (A per-letter CSS animation
 * left some letters stuck invisible, so "can" read "c n".)
 */
function TypeLine({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const all = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setInterval(() => setN((k) => (all || k >= text.length ? text.length : k + 1)), TYPE_MS);
    return () => clearInterval(id);
  }, [text]);
  return (
    <>
      {text.slice(0, n)}
      {/* The rest is laid out but invisible, so the line never reflows while it types. */}
      <span aria-hidden className="invisible">
        {text.slice(n)}
      </span>
    </>
  );
}

function Line({ text, entrance, bang }: { text: string; entrance: Entrance; bang?: string }) {
  if (entrance === "words") {
    return text.split(" ").map((w, i) => (
      <span key={i}>
        <span
          className={`kinetic-word${w === bang ? " kinetic-bang" : ""}`}
          style={{ "--i": i } as CSSProperties}
        >
          {w}
        </span>{" "}
      </span>
    ));
  }
  if (entrance === "type") return <TypeLine text={text} />;
  return <span className={`quote-${entrance}`}>{text}</span>;
}

/** While a story is analysed: a new line on setup and payoff every few seconds, each with its own entrance. */
export default function QuoteRotator() {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let out: ReturnType<typeof setTimeout>;
    const timer = setInterval(() => {
      setLeaving(true);
      out = setTimeout(() => {
        setIndex((i) => (i + 1) % QUOTES.length);
        setLeaving(false);
      }, OUT_MS);
    }, SHOW_MS);
    return () => {
      clearInterval(timer);
      clearTimeout(out);
    };
  }, []);

  const q = QUOTES[index];
  return (
    <figure
      aria-hidden
      className={`flex min-h-[9rem] flex-col gap-2 transition-opacity duration-300 sm:min-h-[7.5rem] ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <blockquote key={index} className="font-display text-xl italic leading-snug text-ink-soft sm:text-2xl">
        <Line text={q.text} entrance={q.entrance} bang={q.bang} />
      </blockquote>
      <figcaption key={`by-${index}`} className="quote-by text-sm text-muted">
        — {q.by}
      </figcaption>
    </figure>
  );
}
