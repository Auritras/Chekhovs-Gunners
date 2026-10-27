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
      <label htmlFor={`${id}-text`} className="font-medium">
        Your story
      </label>
      <textarea
        id={`${id}-text`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        placeholder="Paste your story here, or upload a file."
        className="w-full rounded border border-gray-300 p-3 text-base"
      />
      <p aria-live="polite" className="text-sm text-gray-600">
        {words.toLocaleString("en-US")} {words === 1 ? "word" : "words"}
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-file`} className="text-sm">
            Upload a file (.txt, .md, .docx, .pdf)
          </label>
          <input
            id={`${id}-file`}
            type="file"
            accept=".txt,.md,.docx,.pdf"
            onChange={onFile}
            disabled={busy}
            className="text-sm"
          />
        </div>
        {samples.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-sample`} className="text-sm">
              Or try a sample
            </label>
            <select
              id={`${id}-sample`}
              defaultValue=""
              onChange={onSample}
              className="rounded border border-gray-300 p-1 text-sm"
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
          className="ml-auto rounded bg-black px-4 py-2 text-white disabled:opacity-40"
        >
          Analyse
        </button>
      </div>
    </section>
  );
}
