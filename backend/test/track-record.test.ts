import assert from "node:assert/strict";
import { test } from "node:test";
import { TrackRecord } from "../src/analysis/track-record.ts";
import { analyze } from "../src/analysis/verify.ts";
import { articles, sourceMap } from "./fixtures/breaking.ts";

test("scores each source's first number against the final official figure, once per settled event", () => {
  const events = analyze(articles, sourceMap);
  const record = new TrackRecord();

  // At 16:00 only yesterday's Peru quake has had 12 quiet hours.
  assert.equal(record.update(events, new Date("2026-10-14T16:00:00Z")), 1);

  const later = new Date("2026-10-15T12:00:00Z");
  assert.ok(record.update(events, later) >= 4);
  // Quake killed: official final 15. BBC first said 5 (low), NPR/Sky (Reuters) 12 (low), Guardian 14 (close), DW 15 (close).
  assert.equal(record.sources.get("bbc-world")?.numbersLow, 1);
  assert.equal(record.sources.get("guardian")?.numbersClose, 2, "killed 14 and injured 120");
  assert.equal(record.sources.get("dw")?.numbersClose, 1);
  // Shooting killed: official 3; Fox first said 4 (high).
  assert.ok((record.sources.get("fox")?.numbersHigh ?? 0) >= 1);
  // Minister story was disputed: everyone who reported it gets a mark.
  assert.equal(record.sources.get("independent")?.disputedOrRetracted, 1);
  // Social posts are never scored.
  assert.equal(record.sources.has("reddit"), false);

  assert.equal(record.update(events, later), 0, "each event is evaluated once");
  const restored = TrackRecord.restore(JSON.parse(JSON.stringify(record.snapshot())));
  assert.equal(restored.update(events, later), 0, "evaluated ids survive a restart");
});
