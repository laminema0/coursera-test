import assert from "node:assert/strict";
import { test } from "node:test";
import { StatusHistory } from "../src/analysis/history.ts";
import { analyze } from "../src/analysis/verify.ts";
import type { Article } from "../src/sources/types.ts";
import { sourceMap } from "./fixtures/breaking.ts";

function article(id: string, source: string, title: string, at: string): Article {
  const iso = new Date(at).toISOString();
  return { id, url: `https://${source}.test/${id}`, title, publishedAt: iso, fetchedAt: iso, language: "en", sourceIds: [source] };
}

test("records each status change as an event develops", () => {
  const history = new StatusHistory();
  const a1 = article("h1", "reddit", "Explosion heard near Riverside port in Atlantis city", "2026-10-15T10:00:00Z");
  const a2 = article("h2", "fox", "Explosion reported at Riverside port in Atlantis city", "2026-10-15T10:10:00Z");
  const a3 = article("h3", "guardian", "Explosion rocks Riverside port in Atlantis city", "2026-10-15T10:30:00Z");

  history.record(analyze([a1], sourceMap), new Date("2026-10-15T10:01:00Z"));
  assert.equal(history.record(analyze([a1], sourceMap), new Date("2026-10-15T10:05:00Z")), false, "no change, nothing stored");
  history.record(analyze([a1, a2], sourceMap), new Date("2026-10-15T10:11:00Z"));
  history.record(analyze([a1, a2, a3], sourceMap), new Date("2026-10-15T10:31:00Z"));

  assert.deepEqual(history.get("h1"), [
    { status: "unverified", at: "2026-10-15T10:00:00.000Z", confirming: 0 },
    { status: "reported", at: "2026-10-15T10:11:00.000Z", confirming: 1 },
    { status: "corroborated", at: "2026-10-15T10:31:00.000Z", confirming: 2 },
  ]);

  const restored = StatusHistory.restore(JSON.parse(JSON.stringify(history.snapshot())));
  assert.equal(restored.get("h1").length, 3);

  history.record([], new Date("2026-10-18T00:00:00Z"));
  assert.deepEqual(history.get("h1"), [], "expired events are forgotten");
});
