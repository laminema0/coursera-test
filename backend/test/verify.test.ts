import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/analysis/verify.ts";
import type { Article } from "../src/sources/types.ts";
import { articles, expectedEvent, sourceMap } from "./fixtures/breaking.ts";

const events = analyze(articles, sourceMap);
const eventFor = (label: string) => events.find((e) => e.articleIds.some((id) => expectedEvent.get(id) === label))!;

test("earthquake with USGS report is confirmed", () => {
  const quake = eventFor("quake");
  assert.equal(quake.verification.status, "confirmed");
  assert.equal(quake.verification.primary, 1);
  assert.equal(quake.verification.signals, 1);
});

test("earthquake numbers: range, most reported (latest per source), latest official", () => {
  const killed = eventFor("quake").numbers.find((n) => n.kind === "killed")!;
  assert.equal(killed.min, 5);
  assert.equal(killed.max, 15);
  // Latest per origin: BBC 5, Reuters 12, Guardian 14, Al Jazeera 14, DW 15 → 14 is most reported.
  assert.deepEqual(killed.mostReported, { value: 14, origins: 2 });
  assert.equal(killed.latestOfficial?.value, 15);
  assert.equal(killed.latestOfficial?.sourceId, "dw");

  const magnitude = eventFor("quake").numbers.find((n) => n.kind === "magnitude")!;
  assert.deepEqual(magnitude.mostReported.value, 6.1);
  assert.equal(magnitude.latestOfficial?.sourceId !== undefined, true);
});

test("shooting: conflicting numbers resolve to the most reported, witnesses don't count as official", () => {
  const shooting = eventFor("shooting");
  assert.equal(shooting.verification.status, "corroborated");
  const killed = shooting.numbers.find((n) => n.kind === "killed")!;
  assert.deepEqual([killed.min, killed.max], [3, 4]);
  assert.deepEqual(killed.mostReported, { value: 3, origins: 3 });
  assert.equal(killed.latestOfficial?.value, 3);
  const injured = shooting.numbers.find((n) => n.kind === "injured")!;
  assert.deepEqual([injured.min, injured.max, injured.latestOfficial?.value], [7, 8, 8]);
});

test("minister statement denied by the ministry is disputed", () => {
  const minister = eventFor("minister");
  assert.equal(minister.verification.status, "disputed");
  assert.equal(minister.verification.confirming, 2);
  assert.equal(minister.verification.disputing, 1);
  const weber = minister.statements.find((s) => s.speakerKey === "weber");
  assert.ok(weber && weber.asserts >= 2, JSON.stringify(minister.statements));
  assert.ok(minister.statements.some((s) => s.speakerKey === "finance ministry" && s.denies === 1));
});

test("official flood warning is confirmed", () => {
  assert.equal(eventFor("flood").verification.status, "confirmed");
});

function article(id: string, source: string, title: string, summary?: string, at = "2026-10-15T10:00:00Z"): Article {
  return { id, url: `https://${source}.test/${id}`, title, summary, publishedAt: at, fetchedAt: at, language: "en", sourceIds: [source] };
}

test("status ladder: social only → one source → corroborated", () => {
  const social = [article("s1", "reddit", "Explosion heard near Riverside port in Atlantis city")];
  assert.equal(analyze(social, sourceMap)[0]?.verification.status, "unverified");

  const oneSource = [...social, article("o1", "fox", "Explosion reported at Riverside port in Atlantis city", undefined, "2026-10-15T10:10:00Z")];
  assert.equal(analyze(oneSource, sourceMap)[0]?.verification.status, "reported");

  const copies = [...oneSource, article("o2", "cbs", "Explosion at Atlantis Riverside port, Reuters reports", undefined, "2026-10-15T10:12:00Z"),
    article("o3", "sky", "Explosion at Atlantis Riverside port, Reuters reports", undefined, "2026-10-15T10:13:00Z")];
  const twoTier2 = analyze(copies, sourceMap)[0]!;
  assert.equal(twoTier2.verification.confirming, 2, "two Reuters copies count once");
  assert.equal(twoTier2.verification.status, "reported", "two tier-2 origins are not enough");

  const withTier1 = [...copies, article("o4", "guardian", "Explosion rocks Riverside port in Atlantis city", undefined, "2026-10-15T10:30:00Z")];
  assert.equal(analyze(withTier1, sourceMap)[0]?.verification.status, "corroborated");
});

test("a retraction overrides everything", () => {
  const items = [
    article("r1", "guardian", "Atlantis president Mara Quell resigns, aides say"),
    article("r2", "bbc-world", "Atlantis president Mara Quell resigns", undefined, "2026-10-15T10:05:00Z"),
    article("r3", "npr", "Correction: Atlantis president Mara Quell has not resigned; earlier report retracted", undefined, "2026-10-15T11:00:00Z"),
  ];
  assert.equal(analyze(items, sourceMap)[0]?.verification.status, "retracted");
});
