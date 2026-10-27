// Runs each sample once and writes public/samples/<slug>/result.json.
// Usage: npm run build-samples   (needs GEMINI_API_KEY_DEV in .env.local)
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "@/lib/pipeline/analyze";
import { listSamples, nodeDeps } from "./lib/nodeDeps";

async function main() {
  const deps = nodeDeps(); // exits 1 if GEMINI_API_KEY_DEV is missing
  const samples = listSamples();
  if (samples.length === 0) {
    console.error("No samples found (expected samples/<slug>/answer-key.json).");
    process.exit(1);
  }
  let failed = false;
  for (const s of samples) {
    console.log(`Analysing ${s.slug} (${s.chapters.length} chapters)...`);
    const outcome = await analyze(s.chapters, deps, (p) => {
      if (p.stage === "extract") console.log(`  chapter ${p.chapter}/${p.of}`);
      if (p.stage === "waiting") console.log("  waiting for Gemini…");
    });
    if (outcome.status !== "ok") {
      console.error(`  ${s.slug}: daily quota exhausted, result not written.`);
      failed = true;
      continue;
    }
    if (outcome.result.failedChapters.length > 0) {
      console.error(`  ${s.slug}: chapters ${outcome.result.failedChapters.join(", ")} failed, result not written.`);
      failed = true;
      continue;
    }
    const out = join("public", "samples", s.slug, "result.json");
    writeFileSync(out, JSON.stringify(outcome.result, null, 2) + "\n");
    console.log(`  wrote ${out}`);
  }
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
