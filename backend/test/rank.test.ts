import assert from "node:assert/strict";
import { test } from "node:test";
import { rankEvent } from "../src/analysis/rank.ts";
import { analyze } from "../src/analysis/verify.ts";
import { articles, expectedEvent, sourceMap } from "./fixtures/breaking.ts";

const byId = new Map(articles.map((a) => [a.id, a]));
const events = analyze(articles, sourceMap);
const eventFor = (label: string) => events.find((e) => e.articleIds.some((id) => expectedEvent.get(id) === label))!;

test("big developing stories outrank single-source news", () => {
  const now = new Date("2026-10-14T16:45:00Z");
  const quake = rankEvent(eventFor("quake"), byId, now);
  const shooting = rankEvent(eventFor("shooting"), byId, now);
  const iphone = rankEvent(eventFor("iphone"), byId, now);
  assert.ok(quake.importance > iphone.importance);
  assert.ok(shooting.importance > iphone.importance);
  assert.equal(iphone.breaking, false);
});

test("breaking: new sources in the last hour, official alerts or casualties", () => {
  const shooting = rankEvent(eventFor("shooting"), byId, new Date("2026-10-14T16:45:00Z"));
  assert.equal(shooting.newOriginsLastHour, 2, "CBC (16:10) and NPR (16:40) joined within the hour");
  assert.equal(shooting.breaking, true);

  const lateNight = rankEvent(eventFor("shooting"), byId, new Date("2026-10-15T03:00:00Z"));
  assert.equal(lateNight.breaking, false, "no longer breaking after 6 hours");
  assert.equal(lateNight.newOriginsLastHour, 0);
});
