import type { AnalysisResult, Setup } from "@/lib/types";
import { isWriterGun, type Overrides } from "@/lib/view/overrides";
import { summaryCounts } from "@/lib/view/summaryCounts";

/**
 * The report as notes a writer can take to their editor: the loose ends with quotes and
 * chapter references, the writer's own decisions, and the guns that fired.
 */
export function notesMarkdown(result: AnalysisResult, overrides: Overrides, date = new Date()): string {
  const title = (n: number) => result.chapters.find((c) => c.index === n)?.title || `Chapter ${n}`;
  const byId = new Map(result.setups.map((s) => [s.id, s]));
  const payoffs = new Map(result.payoffs.map((p) => [p.id, p]));
  const c = summaryCounts(result, overrides);
  const words = result.chapters.reduce((n, ch) => n + ch.text.split(/\s+/).filter(Boolean).length, 0);
  const quote = (q: string) => `  > ${q.replace(/\s+/g, " ").trim()}`;
  const line = (s: Setup) => `**${s.summary}** (${title(s.chapter)}, ${s.kind})`;
  const out: string[] = [];

  out.push("# Notes from Chekhov's Gunners", "");
  out.push(
    `${result.chapters.length} chapters, ${words.toLocaleString("en-US")} words · ${date.toISOString().slice(0, 10)}`,
    "",
  );
  out.push(
    `- ${c.planted} setups planted`,
    `- ${c.fired} fired${c.firedByWriter ? ` (${c.firedByWriter} marked by you)` : ""}`,
    `- ${c.neverFired} never fired`,
    ...(c.uncertain ? [`- ${c.uncertain} uncertain (a chapter could not be analysed)`] : []),
    ...(c.setAside ? [`- ${c.setAside} set aside by you`] : []),
    "",
  );

  const uncertain = new Set(result.uncertain);
  const loose = result.setups.filter((s) => result.unfired.includes(s.id) && !overrides[s.id]);
  out.push("## Loose ends: guns that never fire", "");
  if (loose.length === 0) out.push("None. Every gun fires.", "");
  for (const s of loose) {
    out.push(`- ${line(s)}${uncertain.has(s.id) ? " *(uncertain: a failed chapter may hold its payoff)*" : ""}`);
    out.push(quote(s.quote), "");
  }

  const calls = Object.entries(overrides).filter(([id]) => byId.has(id));
  const fired = calls.filter(([, o]) => o.kind === "fired");
  const setAside = calls.filter(([, o]) => o.kind === "dismissed");
  const added = result.setups.filter((s) => isWriterGun(s.id));
  if (fired.length || setAside.length || added.length) {
    out.push("## Your decisions", "");
    if (fired.length) {
      out.push("### Marked as firing (the tool said they never do)", "");
      for (const [id, o] of fired) {
        if (o.kind !== "fired") continue;
        const s = byId.get(id)!;
        out.push(`- ${line(s)}: fires in ${title(o.chapter)}`);
        if (o.quote) out.push(quote(o.quote));
        out.push("");
      }
    }
    if (setAside.length) {
      out.push("### Set aside: not a gun", "");
      for (const [id] of setAside) {
        const s = byId.get(id)!;
        out.push(`- ${line(s)}`, quote(s.quote), "");
      }
    }
    if (added.length) {
      out.push("### Guns you added", "");
      for (const s of added) out.push(`- **${s.summary}** (${title(s.chapter)})`, quote(s.quote), "");
    }
  }

  const firedByTool = result.setups.filter((s) => result.matches.some((m) => m.setupId === s.id));
  if (firedByTool.length) {
    out.push("## Guns that fired", "");
    for (const s of firedByTool) {
      out.push(`- ${line(s)}`);
      for (const m of result.matches.filter((x) => x.setupId === s.id)) {
        const p = payoffs.get(m.payoffId);
        if (p) out.push(`  - fires in ${title(p.chapter)}: ${p.summary}`);
      }
      out.push("");
    }
  }

  out.push("---", "", "*Made with Chekhov's Gunners. It suggests; the writer decides.*", "");
  return out.join("\n");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s: string) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");

/** The notes as a print-ready HTML page (for "Save as PDF"). Handles exactly what notesMarkdown writes. */
export function notesHtml(markdown: string): string {
  const body: string[] = [];
  for (const raw of markdown.split("\n")) {
    const l = raw.trimEnd();
    if (l.startsWith("### ")) body.push(`<h3>${inline(l.slice(4))}</h3>`);
    else if (l.startsWith("## ")) body.push(`<h2>${inline(l.slice(3))}</h2>`);
    else if (l.startsWith("# ")) body.push(`<h1>${inline(l.slice(2))}</h1>`);
    else if (l.startsWith("  > ")) body.push(`<blockquote>${inline(l.slice(4))}</blockquote>`);
    else if (l.startsWith("  - ")) body.push(`<p class="sub">${inline(l.slice(4))}</p>`);
    else if (l.startsWith("- ")) body.push(`<p class="item">${inline(l.slice(2))}</p>`);
    else if (l === "---") body.push("<hr>");
    else if (l) body.push(`<p>${inline(l)}</p>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>Notes from Chekhov's Gunners</title>
<style>
  body { font: 11.5pt/1.5 Georgia, "Times New Roman", serif; color: #1d1714; margin: 2cm; }
  h1 { font-size: 22pt; margin: 0 0 4pt; } h2 { font-size: 15pt; margin: 18pt 0 6pt; border-bottom: 1px solid #c9b88f; }
  h3 { font-size: 12pt; margin: 12pt 0 4pt; } p { margin: 3pt 0; } .item { margin-top: 8pt; }
  .sub { margin-left: 1.2em; color: #4a3f37; } blockquote { margin: 2pt 0 0 1.2em; font-style: italic; color: #4a3f37; }
  hr { border: 0; border-top: 1px solid #c9b88f; margin: 18pt 0 6pt; }
</style></head><body>${body.join("\n")}</body></html>`;
}
