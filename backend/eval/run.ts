// Offline quality benchmark for the analysis engine.
// Usage: npm run eval                  (summary for train/test/all + worst mistakes on the train split)
//        npm run eval -- --show-test   (also list test-split mistakes; look only after tuning is done)
//        npm run eval -- --all-errors  (every mistake, not just the worst)
//        npm run eval -- --json out.json
//        npm run eval -- --no-perf
import { writeFileSync } from "node:fs";
import { analyze } from "../src/analysis/verify.ts";
import { buildCorpus, events, splitOf } from "./dataset/index.ts";
import { evaluate, KINDS, type SplitReport, STATUSES } from "./metrics.ts";
import { loadSources } from "./sources.ts";
import { syntheticCorpus } from "./synthetic.ts";

const args = process.argv.slice(2);
const showTest = args.includes("--show-test");
const allErrors = args.includes("--all-errors");
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : undefined;
const limit = allErrors ? Infinity : 8;

const sources = loadSources();
for (const e of events) for (const a of e.articles) if (!sources.has(a.source)) throw new Error(`${e.id}: unknown source ${a.source}`);

const corpus = buildCorpus();
const result = evaluate(corpus, sources);

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const ratio = (t: { correct: number; total: number }) => `${pct(t.total ? t.correct / t.total : 1)} (${t.correct}/${t.total})`;

console.log(`Benchmark: ${events.length} events, ${corpus.length} articles · analyzed in ${result.analyzeMs.toFixed(0)} ms\n`);

console.log("                         train      test       all");
const row = (label: string, f: (r: SplitReport) => string) =>
  console.log(`${label.padEnd(24)} ${(["train", "test", "all"] as const).map((s) => f(result.bySplit[s]).padEnd(10)).join(" ")}`);
row("events / articles", (r) => `${r.events}/${r.articles}`);
row("clusters B³ precision", (r) => pct(r.clusters.precision));
row("clusters B³ recall", (r) => pct(r.clusters.recall));
row("clusters B³ F1", (r) => pct(r.clusters.f1));
row("merged / split events", (r) => `${r.clusters.merged.length} / ${r.clusters.split.length}`);
row("numbers precision", (r) => pct(r.claims.overall.precision));
row("numbers recall", (r) => pct(r.claims.overall.recall));
row("numbers F1", (r) => pct(r.claims.overall.f1));
row("qualifier accuracy", (r) => pct(r.claims.qualifierAccuracy.correct / Math.max(1, r.claims.qualifierAccuracy.total)));
row("attribution accuracy", (r) => pct(r.claims.attributionAccuracy.correct / Math.max(1, r.claims.attributionAccuracy.total)));
row("denial P / R", (r) => `${pct(r.claims.denial.precision)}/${pct(r.claims.denial.recall)}`);
row("retraction P / R", (r) => `${pct(r.claims.retraction.precision)}/${pct(r.claims.retraction.recall)}`);
row("status accuracy", (r) => pct(r.status.accuracy.correct / r.status.accuracy.total));
row("status (true grouping)", (r) => pct(r.status.oracleAccuracy.correct / r.status.oracleAccuracy.total));

const all = result.bySplit.all;
console.log("\nNumbers per kind (all):  precision  recall   tp  fp  fn");
for (const kind of KINDS) {
  const k = all.claims.perKind[kind]!;
  if (k.tp + k.fp + k.fn === 0) continue;
  console.log(`  ${kind.padEnd(22)} ${pct(k.precision).padStart(7)}  ${pct(k.recall).padStart(7)} ${String(k.tp).padStart(4)} ${String(k.fp).padStart(3)} ${String(k.fn).padStart(3)}`);
}

console.log("\nStatus confusion (all; rows = expected, columns = predicted):");
const short = (s: string) => s.slice(0, 6);
console.log(`  ${"".padEnd(13)}${STATUSES.map((s) => short(s).padStart(8)).join("")}`);
for (const expected of STATUSES) {
  const cells = STATUSES.map((got) => String(all.status.confusion[expected]![got] || "·").padStart(8)).join("");
  console.log(`  ${expected.padEnd(13)}${cells}`);
}

// Mistakes: from the train split by default, so tuning never looks at the held-out events.
const visible = showTest ? all : result.bySplit.train;
const tag = (event: string) => (splitOf(event) === "test" ? " [test]" : "");
console.log(`\nWorst mistakes (${showTest ? "all splits" : "train split only; --show-test to include held-out events"}):`);

const section = <T>(title: string, items: T[], line: (t: T) => string) => {
  if (items.length === 0) return;
  console.log(`\n  ${title} (${items.length}):`);
  for (const item of items.slice(0, limit)) console.log(`    - ${line(item)}`);
  if (items.length > limit) console.log(`    … ${items.length - limit} more (--all-errors)`);
};
section("Merged events", visible.clusters.merged, (m) => `"${m.title}" ← ${m.parts.map((p) => `${p.event}${tag(p.event)}×${p.articles}`).join(" + ")}`);
section("Split events", visible.clusters.split, (s) => `${s.event}${tag(s.event)} → ${s.parts.map((p) => `"${p.title}"×${p.articles}`).join(" | ")}`);
section("Wrong status", visible.status.wrong, (w) => `${w.event}${tag(w.event)}: expected ${w.expected}, got ${w.got} (true grouping: ${w.oracle}) · ${w.reason}`);
section("Missed numbers", visible.claims.falseNegatives, (f) => `${f.expected}${tag(f.event)} in "${f.title}"${f.got.length ? ` (got ${f.got.join(", ")})` : ""}`);
section("Spurious numbers", visible.claims.falsePositives, (f) => `${f.got}${tag(f.event)} in "${f.title}"`);
section("Wrong attribution", visible.claims.wrongAttribution, (w) => `expected ${w.expected}, got ${w.got}${tag(w.event)} in "${w.title}"`);
section("Denial/retraction flags", visible.claims.flagErrors, (f) => `${f.expected ? "missed" : "spurious"} ${f.flag}${tag(f.event)}: "${f.title}"`);

let perfOk = true;
if (!args.includes("--no-perf")) {
  const synthetic = syntheticCorpus(20_000, [...sources.values()]);
  analyze(synthetic.slice(0, 2_000), sources); // warm up the JIT
  const started = performance.now();
  const out = analyze(synthetic, sources);
  const ms = performance.now() - started;
  perfOk = ms < 5_000;
  console.log(`\nPerformance: ${synthetic.length} synthetic articles → ${out.length} events in ${(ms / 1000).toFixed(2)} s (budget 5 s) ${perfOk ? "OK" : "TOO SLOW"}`);
}

if (jsonOut) {
  writeFileSync(jsonOut, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`\nWrote ${jsonOut}`);
}
if (!perfOk) process.exitCode = 1;
