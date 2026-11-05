"use client";

import type { AnalysisResult } from "@/lib/types";
import { notesHtml, notesMarkdown } from "@/lib/view/notes";
import type { Overrides } from "@/lib/view/overrides";

const button =
  "min-h-11 rounded-sm border border-line px-3 text-sm font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink";

/** "Download notes": the loose ends and the writer's decisions, as Markdown or as a PDF. */
export default function DownloadNotes({
  result,
  overrides,
  title,
}: {
  result: AnalysisResult;
  overrides: Overrides;
  /** The story's title, when known (a sample's), for the programme heading. */
  title?: string;
}) {
  const notes = () => notesMarkdown(result, overrides, new Date(), title);
  function markdown() {
    const blob = new Blob([notes()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chekhovs-gunners-notes.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Print a clean notes page from a hidden frame; the browser's dialog offers "Save as PDF". */
  function pdf() {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc || !frame.contentWindow) return frame.remove();
    doc.open();
    doc.write(notesHtml(notes()));
    doc.close();
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60_000);
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-xs uppercase tracking-[0.16em] text-muted">Download notes</span>
      <button type="button" onClick={markdown} className={button}>
        Markdown
      </button>
      <button type="button" onClick={pdf} className={button}>
        PDF
      </button>
    </div>
  );
}
