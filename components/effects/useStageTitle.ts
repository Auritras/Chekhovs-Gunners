"use client";

import { useEffect, useRef } from "react";
import type { RunState } from "@/components/RunStatus";

const TITLE = "Chekhov's Gunners";

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
      if (!document.hidden) readyWhileAway.current = false;
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
