"use client";

import { useEffect, useId, useState } from "react";
import { readFile } from "@/lib/input/readFile";

type Sample = { slug: string; title: string };

const ERRORS = {
  unsupported: "That file type isn't supported. Try .txt, .md, .docx or .pdf.",
  no_text:
    "We couldn't read text from that file — it may be a scanned PDF. Try pasting the text instead.",
  unreadable:
    "We couldn't read text from that file — it may be a scanned PDF. Try pasting the text instead.",
} as const;

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export default function InputPanel({
  onAnalyse,
  disabled = false,
}: {
  onAnalyse: (text: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/samples/index.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (cancelled || !Array.isArray(data)) return;
        const valid = data.filter(
          (s): s is Sample =>
            !!s && typeof s.slug === "string" && typeof s.title === "string",
        );
        setSamples(valid);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    const result = await readFile(file);
    setBusy(false);
    input.value = "";
    if ("error" in result) setError(ERRORS[result.error]);
    else setText(result.text);
  }

  async function onSample(e: React.ChangeEvent<HTMLSelectElement>) {
    const slug = e.target.value;
    if (!slug) return;
    setError(null);
    try {
      const r = await fetch(`/samples/${encodeURIComponent(slug)}/story.md`);
      if (!r.ok) throw new Error("bad response");
      setText(await r.text());
    } catch {
      setError("We couldn't load that sample. Try pasting the text instead.");
    }
    e.target.value = "";
  }

  const words = countWords(text);
  const canAnalyse = words > 0 && !disabled;

  return (
    <section className="flex flex-col gap-3">
      <label htmlFor={`${id}-text`} className="font-display text-2xl">
        Your story
      </label>
      <textarea
        id={`${id}-text`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        placeholder="Paste your story here, or upload a file."
        className="w-full resize-y rounded-sm border border-line bg-surface p-4 font-serif text-base leading-relaxed text-ink placeholder:text-muted focus:border-ink focus:outline-none"
      />
      <p aria-live="polite" className="text-sm text-ink-soft tabular-nums">
        {words.toLocaleString("en-US")} {words === 1 ? "word" : "words"}
      </p>
      {error && (
        <p role="alert" className="text-sm text-curtain">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-file`} className="text-sm text-ink-soft">
            Upload a file (.txt, .md, .docx, .pdf)
          </label>
          <input
            id={`${id}-file`}
            type="file"
            accept=".txt,.md,.docx,.pdf"
            onChange={onFile}
            disabled={busy}
            className="max-w-full text-sm file:mr-3 file:rounded-sm file:border file:border-ink file:bg-transparent file:px-3 file:py-1.5 file:text-ink hover:file:bg-ink hover:file:text-paper"
          />
        </div>
        {samples.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-sample`} className="text-sm text-ink-soft">
              Or try a sample
            </label>
            <select
              id={`${id}-sample`}
              defaultValue=""
              onChange={onSample}
              className="rounded-sm border border-line bg-surface px-2 py-1.5 text-sm text-ink"
            >
              <option value="">Choose a sample…</option>
              {samples.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          onClick={() => onAnalyse(text)}
          disabled={!canAnalyse}
          className="w-full rounded-sm bg-curtain px-6 py-2.5 font-display text-xl text-curtain-ink transition-colors hover:bg-curtain-deep disabled:cursor-not-allowed disabled:opacity-40 sm:ml-auto sm:w-auto"
        >
          Analyse
        </button>
      </div>
    </section>
  );
}
