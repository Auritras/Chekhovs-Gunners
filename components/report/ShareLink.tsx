"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import type { Overrides, WriterGun } from "@/lib/view/overrides";
import { encodeReport, MAX_LINK_CHARS } from "@/lib/view/share";

const button =
  "min-h-11 rounded-sm border border-line px-3 text-sm font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink";

/** "Copy link": the whole report, with the writer's calls, packed into a link to send. */
export default function ShareLink({
  result,
  overrides,
  guns,
  title,
}: {
  result: AnalysisResult;
  overrides: Overrides;
  guns: WriterGun[];
  title: string;
}) {
  const [status, setStatus] = useState<string | null>(null);
  async function copy() {
    try {
      const fragment = await encodeReport({ result, overrides, guns, title });
      const url = `${window.location.origin}${window.location.pathname}#${fragment}`;
      if (url.length > MAX_LINK_CHARS) {
        setStatus("Too long for a link. Download the notes instead.");
        return;
      }
      // The address bar holds the link too, so it can be copied from there.
      window.history.replaceState(null, "", `#${fragment}`);
      await navigator.clipboard.writeText(url);
      setStatus("Link copied");
    } catch {
      setStatus("Couldn't copy. The link is in the address bar.");
    }
    setTimeout(() => setStatus(null), 4000);
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-xs uppercase tracking-[0.16em] text-muted" aria-live="polite">
        {status ?? "Share"}
      </span>
      <button type="button" onClick={copy} className={button}>
        Copy link
      </button>
    </div>
  );
}
