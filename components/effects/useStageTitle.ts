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
      '<path transform="translate(-5.6 12) scale(0.85)" d="M18 11.6 Q18.2 10.8 19 11 L21.3 12.4 Q21.8 12.8 21.8 13.4 V14 H27.5 V13.2 Q27.5 11.9 28.8 11.9 H43 Q44.4 11.9 44.4 13.3 V15.5 H70.8 L71.2 13.6 Q72.3 12.6 73.2 13.4 L73.6 15.5 H74.6 Q75.2 15.6 75.2 16.4 V19.8 Q75.2 20.6 74.4 20.6 H61.5 V23.2 Q61.5 24 60.7 24 H58.5 Q57.8 24 57.6 23 L57.4 22.4 H44.4 V26.6 Q44.4 28 43 28 H26.2 Q24.6 28 24.4 29.8 L25.2 45.2 Q25.3 46.6 24 46.6 H14.8 Q13.4 46.6 13.6 45.2 L18.2 17.6 Q18.4 16.2 18.3 15 Z" fill="#d6b25b"/>' +
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
