// Runs the pipeline N times per sample and prints a Markdown table of averaged metrics.
// Usage: npm run prompt-check [-- --runs 5]   (needs GEMINI_API_KEY_DEV in .env.local)
//
// "Cache bypassed for extraction": every run gets a brand-new in-memory cache
// (never the .cache/ file store), so no run can reuse another run's extraction
// or match results and the runs are independent.
import { readFileSync } from "node:fs";
import { analyze } from "@/lib/pipeline/analyze";
import { memoryCache } from "@/lib/cache";
import { scoreRun, type AnswerKey, type RunScore } from "@/lib/metrics";
import { listSamples, nodeDeps } from "./lib/nodeDeps";

function parseRuns(argv: string[]): number {
  const i = argv.indexOf("--runs");
  if (i === -1) return 5;
  const n = Number(argv[i + 1]);
  if (!Number.isInteger(n) || n < 1) {
    console.error("--runs must be a positive integer.");
    process.exit(1);
  }
  return n;
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const num = (x: number) => x.toFixed(1);

async function main() {
  const runs = parseRuns(process.argv.slice(2));
  nodeDeps(); // fail fast (exit 1) when the dev key is missing
  const samples = listSamples();
  if (samples.length === 0) {
    console.error("No samples found (expected samples/<slug>/answer-key.json).");
    process.exit(1);
  }

  const rows: string[] = [];
  let model = "";
  let versions = { extract: "", match: "" };
  for (const s of samples) {
    const key = JSON.parse(readFileSync(s.keyPath, "utf8")) as AnswerKey;
    const scores: RunScore[] = [];
    for (let r = 1; r <= runs; r++) {
      console.error(`${s.slug}: run ${r}/${runs}`);
      const deps = nodeDeps(memoryCache());
      const outcome = await analyze(s.chapters, deps);
      if (outcome.status !== "ok") {
        console.error("Daily quota exhausted; stopping.");
        process.exit(1);
      }
      model = outcome.result.model;
      versions = outcome.result.promptVersions;
      scores.push(scoreRun(outcome.result, key));
    }
    rows.push(
      `| ${s.slug} | ${pct(avg(scores.map((x) => x.recall)))} | ${num(avg(scores.map((x) => x.wrongSetups)))} | ${num(avg(scores.map((x) => x.wrongMatches)))} | ${num(avg(scores.map((x) => x.unfiredCorrect)))}/${scores[0].unfiredTotal} | ${pct(avg(scores.map((x) => x.dropRate)))} |`,
    );
  }

  console.log("| Sample | Recall | Wrong setups | Wrong matches | Unfired correct | Drop rate |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  for (const r of rows) console.log(r);
  console.log("");
  console.log(
    `Date: ${new Date().toISOString().slice(0, 10)} | Model: ${model} | Prompts: extract ${versions.extract}, match ${versions.match} | Runs: ${runs}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
