import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCorpus } from "../eval/dataset/index.ts";
import { evaluate } from "../eval/metrics.ts";
import { loadSources } from "../eval/sources.ts";

// Quality floors on the offline benchmark (npm run eval for the full report, docs/QUALITY.md for context).
// Set a little below current results: a change that drops below them is a real regression, not noise.
test("benchmark quality stays above its floors", () => {
  const all = evaluate(buildCorpus(), loadSources()).bySplit.all;
  const ratio = (t: { correct: number; total: number }) => t.correct / t.total;
  assert.ok(all.clusters.f1 >= 0.91, `grouping B³ F1 ${all.clusters.f1.toFixed(3)}`);
  assert.ok(all.clusters.precision >= 0.93, `grouping B³ precision ${all.clusters.precision.toFixed(3)}`);
  assert.ok(all.claims.overall.f1 >= 0.96, `numbers F1 ${all.claims.overall.f1.toFixed(3)}`);
  assert.ok(ratio(all.claims.attributionAccuracy) >= 0.95, "attribution accuracy");
  assert.ok(ratio(all.status.accuracy) >= 0.87, `status accuracy ${ratio(all.status.accuracy).toFixed(3)}`);
  assert.ok(ratio(all.status.oracleAccuracy) >= 0.94, "status accuracy on the true grouping");
});
