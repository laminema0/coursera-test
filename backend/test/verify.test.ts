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
  assert.equal(quake.firstReport?.sourceId, "usgs", "Reddit was not first among real sources");
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
  assert.equal(weber?.asserts, 2, "the denial article doesn't count as a third assertion");
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

test("state media on its own country is the government's voice, not independent confirmation", () => {
  const items = [
    article("q1", "aljazeera", "Qatar says it brokered ceasefire between Atlantis and Lemuria", "Qatar's foreign ministry said talks in Doha produced a ceasefire."),
    article("q2", "fox", "Ceasefire between Atlantis and Lemuria announced after Doha talks", undefined, "2026-10-15T10:20:00Z"),
  ];
  const event = analyze(items, sourceMap)[0]!;
  assert.equal(event.verification.stateMediaOwnCountry, 1);
  assert.equal(event.verification.confirming, 1);
  assert.equal(event.verification.status, "reported");

  // The same outlet on another country's news counts normally.
  const quake = analyze(articles, sourceMap).find((e) => e.title.includes("Malatya"))!;
  assert.equal(quake.verification.stateMediaOwnCountry, 0);
});

test("a denial of a side claim inside the story doesn't dispute the event", () => {
  const sideDenial = { ...articles.find((a) => a.sourceIds[0] === "dw")!, id: "side", summary: "Officials denied reports of a tsunami after the Malatya earthquake killed 15 people." };
  const quake = analyze([...articles.filter((a) => a.sourceIds[0] !== "dw"), sideDenial], sourceMap).find((e) => e.articleIds.includes("side"))!;
  assert.equal(quake.verification.status, "confirmed");
  assert.equal(quake.verification.disputing, 0);
});

test("numbers from social posts are shown as chatter, never as figures", () => {
  const items = [
    article("c1", "reddit", "Explosion at Atlantis Riverside port, at least 20 dead"),
    article("c2", "reddit", "Atlantis port explosion: 20 killed according to people there", undefined, "2026-10-15T10:01:00Z"),
    article("c3", "reddit", "Riverside port explosion Atlantis, 50 dead??", undefined, "2026-10-15T10:02:00Z"),
  ];
  const onlySocial = analyze(items, sourceMap)[0]!;
  assert.deepEqual(onlySocial.numbers, [], "no verified figures from social posts");
  assert.deepEqual(onlySocial.chatterOnly, [{ kind: "killed", values: [{ value: 20, mentions: 2 }, { value: 50, mentions: 1 }] }]);

  const withNews = analyze([...items, article("n1", "guardian", "Explosion at Atlantis Riverside port kills 8, officials say", undefined, "2026-10-15T10:30:00Z")], sourceMap)[0]!;
  const killed = withNews.numbers.find((n) => n.kind === "killed")!;
  assert.equal(killed.mostReported.value, 8);
  assert.deepEqual(killed.chatter[0], { value: 20, mentions: 2 });
  assert.deepEqual(withNews.chatterOnly, []);
});
