"use client";

import { useEffect, useRef } from "react";
import type { RunState } from "@/components/RunStatus";

const TITLE = "Chekhov's Gunners";

/** The favicon with a gold dot: a report is waiting. */
const DOT_ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#1d1714"/>' +
      '<rect width="64" height="9" rx="4" fill="#8c1c22"/>' +
      '<path transform="translate(2 10) scale(0.75)" d="M6 16 H70 V22 H74 V28 H34 Q30 28 29 32 L25 46 Q24 48 21 48 H12 Q9 48 10 45 L15 28 H6 Z" fill="#d6b25b"/>' +
      '<circle cx="50" cy="50" r="12" fill="#f2c94c" stroke="#1d1714" stroke-width="3"/></svg>',
  );
let plainIcon: string | null = null;

/** Show or clear the gold "report ready" dot on the tab's icon. */
function setDot(on: boolean) {
  const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) return;
  plainIcon ??= link.href;
  link.href = on ? DOT_ICON : plainIcon;
}

/**
 * The browser tab title while the writer is on another tab: "Intermission…" normally,
 * "Act 2 of 4" while a story is read, "Curtain up!" if the report finished while away.
 */
export function useStageTitle(run: RunState) {
  const runRef = useRef(run);
  const wasRunning = useRef(false);
  const readyWhileAway = useRef(false);

  useEffect(() => {
    const apply = () => {
      const r = runRef.current;
      if (!document.hidden) document.title = TITLE;
      else if (r.phase === "running") document.title = `Act ${r.chapter} of ${r.of} · ${TITLE}`;
      else if (readyWhileAway.current) document.title = "Curtain up! Your report is ready";
      else document.title = "Intermission…";
    };
    const onVisibility = () => {
      if (!document.hidden) {
        readyWhileAway.current = false;
        setDot(false);
      }
      apply();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    runRef.current = run;
    if (run.phase === "running") wasRunning.current = true;
    else if (wasRunning.current && document.hidden && (run.phase === "done" || run.phase === "sample")) {
      readyWhileAway.current = true;
      setDot(true);
    }
    if (run.phase !== "running") wasRunning.current = false;
    if (document.hidden) {
      document.title =
        run.phase === "running"
          ? `Act ${run.chapter} of ${run.of} · ${TITLE}`
          : readyWhileAway.current
            ? "Curtain up! Your report is ready"
            : "Intermission…";
    }
  }, [run]);
}
