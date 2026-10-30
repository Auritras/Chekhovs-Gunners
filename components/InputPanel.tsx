"use client";

import { useEffect, useId, useRef, useState } from "react";
import { readFile } from "@/lib/input/readFile";
import { loadSampleIndex, loadSampleResult, type SampleInfo } from "@/lib/samples";
import type { AnalysisResult } from "@/lib/types";

/** A sample and its prebuilt analysis, if `npm run build-samples` made one. */
type Sample = SampleInfo & { result: AnalysisResult | null };

const ERRORS = {
  unsupported: "That file type isn't supported. Try .txt, .md, .docx or .pdf.",
  no_text:
    "We couldn't read text from that file — it may be a scanned PDF. Try pasting the text instead.",
  unreadable:
    "We couldn't read text from that file — it may be a scanned PDF. Try pasting the text instead.",
} as const;

const EMPTY_HINT = "Paste a story, drop in a file, or try a sample first.";

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export default function InputPanel({
  onAnalyse,
  onViewSample,
  disabled = false,
  compact = false,
  onEdit,
}: {
  onAnalyse: (text: string) => void;
  /** Show a sample's prebuilt analysis directly (no API calls). */
  onViewSample: (result: AnalysisResult, title: string) => void;
  disabled?: boolean;
  /** Fold the story box to one line (while analysing or showing a report). */
  compact?: boolean;
  onEdit?: () => void;
}) {
  const id = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadSampleIndex().then(async (list) => {
      const withResults = await Promise.all(
        list.map(async (s) => ({ ...s, result: await loadSampleResult(s.slug) })),
      );
      if (!cancelled) setSamples(withResults);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function edit(next: string) {
    setText(next);
    if (error === EMPTY_HINT) setError(null);
  }

  async function loadFile(file: File) {
    setError(null);
    setBusy(true);
    const result = await readFile(file);
    setBusy(false);
    if ("error" in result) setError(ERRORS[result.error]);
    else edit(result.text);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    input.value = "";
    if (file) await loadFile(file);
  }

  function onDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    const file = e.dataTransfer.files[0];
    if (!file) return;
    e.preventDefault();
    setDragging(false);
    if (!busy && !disabled) void loadFile(file);
  }

  async function fillSampleText(slug: string) {
    setError(null);
    try {
      const r = await fetch(`/samples/${encodeURIComponent(slug)}/story.md`);
      if (!r.ok) throw new Error("bad response");
      edit(await r.text());
      textRef.current?.scrollIntoView({ block: "nearest" });
    } catch {
      setError("We couldn't load that sample. Try pasting the text instead.");
    }
  }

  function analyse() {
    if (countWords(text) === 0) {
      setError(EMPTY_HINT);
      textRef.current?.focus();
      return;
    }
    onAnalyse(text);
  }

  const words = countWords(text);

  if (compact && words > 0) {
    return (
      <section
        aria-label="Your story"
        className="playbill flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3"
      >
        <p className="text-sm text-ink-soft">
          <span className="text-xs uppercase tracking-[0.2em]">Your story</span>
          <span className="mx-2" aria-hidden>
            ·
          </span>
          <span className="tabular-nums">{words.toLocaleString("en-US")} words</span>
        </p>
        <button
          type="button"
          onClick={() => {
            onEdit?.();
            requestAnimationFrame(() => textRef.current?.focus());
          }}
          className="min-h-11 rounded-sm border border-ink px-4 text-sm font-medium transition-colors hover:bg-ink hover:text-paper"
        >
          {disabled ? "View text" : "Edit"}
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      {samples.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-soft">New here? See it work on a sample story:</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-3">
            {samples.map((s) => (
              <li key={s.slug} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => (s.result ? onViewSample(s.result, s.title) : fillSampleText(s.slug))}
                  className="min-h-11 rounded-sm border border-brass px-4 py-2 text-left transition-colors hover:bg-brass hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="block font-display text-lg leading-tight">{s.title}</span>
                  <span className="block text-xs opacity-80">
                    {s.result ? "Ready-made analysis, no wait" : "Loads the text for you to analyse"}
                  </span>
                </button>
                {s.result && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => fillSampleText(s.slug)}
                    className="min-h-11 text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-ink disabled:opacity-50"
                  >
                    or load its text
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className="playbill relative flex flex-col gap-2 px-5 pb-4 pt-5 sm:px-7"
      >
        <span aria-hidden className="playbill-corner -left-[5px] -top-[5px]" />
        <span aria-hidden className="playbill-corner -right-[5px] -top-[5px]" />
        <span aria-hidden className="playbill-corner -bottom-[5px] -left-[5px]" />
        <span aria-hidden className="playbill-corner -bottom-[5px] -right-[5px]" />

        <label
          htmlFor={`${id}-text`}
          className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-ink-soft"
        >
          <span aria-hidden className="h-px flex-1 bg-brass opacity-60" />
          Your story
          <span aria-hidden className="h-px flex-1 bg-brass opacity-60" />
        </label>
        <textarea
          ref={textRef}
          id={`${id}-text`}
          value={text}
          onChange={(e) => edit(e.target.value)}
          rows={8}
          placeholder="Paste your story here, or drop a manuscript (.txt, .md, .docx, .pdf) anywhere in this frame."
          className="max-h-[70vh] min-h-48 w-full resize-y bg-transparent [field-sizing:content] font-serif text-base leading-relaxed text-ink placeholder:text-muted focus:outline-none"
        />

        {(dragging || busy) && (
          <div
            aria-hidden={!busy}
            className="absolute inset-2 flex items-center justify-center border-2 border-dashed border-brass bg-surface/95 font-display text-2xl"
          >
            {busy ? "Reading your manuscript…" : "Drop it on the stage"}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <p aria-live="polite" className="text-sm tabular-nums text-ink-soft">
          {words.toLocaleString("en-US")} {words === 1 ? "word" : "words"}
        </p>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-sm border border-ink px-4 text-sm font-medium transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus hover:bg-ink hover:text-paper has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
          Choose a file
          <input
            type="file"
            accept=".txt,.md,.docx,.pdf"
            onChange={onFile}
            disabled={busy}
            className="sr-only"
          />
        </label>
        <button
          type="button"
          onClick={analyse}
          disabled={disabled}
          className="analyse-cock w-full rounded-sm bg-curtain px-8 py-2.5 font-display text-xl text-curtain-ink transition-colors hover:bg-curtain-deep disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto sm:w-auto"
        >
          Analyse
        </button>
      </div>

      {error && (
        <p role="alert" className="-mt-3 text-sm text-curtain sm:text-right">
          {error}
        </p>
      )}
    </section>
  );
}
