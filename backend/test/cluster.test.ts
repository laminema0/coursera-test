import assert from "node:assert/strict";
import { test } from "node:test";
import { clusterArticles } from "../src/analysis/cluster.ts";
import { stem, tokenize } from "../src/analysis/text.ts";
import { articles, expectedEvent, sourceMap } from "./fixtures/breaking.ts";

test("tokenize drops stop words and numbers and stems", () => {
  assert.deepEqual(tokenize("Earthquake kills 12 people in Turkey's Malatya, officials said"), ["earthquake", "kill", "people", "turkey", "malatya", "official"]);
  assert.equal(stem("injuries"), "injury");
  assert.equal(stem("crisis"), "crisis");
});

test("groups breaking-news coverage into the right events", () => {
  const events = clusterArticles(articles, sourceMap);
  const labelsPerEvent = events.map((e) => new Set(e.articleIds.map((id) => expectedEvent.get(id))));
  for (const labels of labelsPerEvent) assert.equal(labels.size, 1, `mixed event: ${[...labels].join(", ")}`);

  const eventsPerLabel = new Map<string, number>();
  for (const labels of labelsPerEvent) {
    const label = [...labels][0]!;
    eventsPerLabel.set(label, (eventsPerLabel.get(label) ?? 0) + 1);
  }
  for (const label of ["quake", "minister", "shooting", "flood"]) {
    assert.equal(eventsPerLabel.get(label), 1, `"${label}" should be exactly one event, got ${eventsPerLabel.get(label)}`);
  }
});

test("counts independent origins: same owner, wire credits and copies collapse", () => {
  const quake = clusterArticles(articles, sourceMap).find((e) => e.articleIds.some((id) => expectedEvent.get(id) === "quake"))!;
  const keys = quake.origins.map((o) => o.key).sort();
  // bbc-world + bbc-top → outlet:bbc; npr + sky (Reuters credit) → wire:reuters.
  assert.deepEqual(keys, ["outlet:aljazeera", "outlet:bbc", "outlet:dw", "outlet:guardian", "primary:usgs", "signal:reddit", "wire:reuters"]);
  assert.equal(quake.independentCount, 6);
  assert.equal(quake.origins.find((o) => o.key === "wire:reuters")?.sourceIds.sort().join(), "npr,sky");
});

test("headline prefers tier-1 or official sources over social posts", () => {
  const shooting = clusterArticles(articles, sourceMap).find((e) => e.articleIds.some((id) => expectedEvent.get(id) === "shooting"))!;
  assert.doesNotMatch(shooting.title, /Shots fired/);
});

test("copies from different owners merge into one origin", () => {
  const copy = { ...articles[0]!, id: "copy", sourceIds: ["independent"], title: "Turkey earthquake: Strong quake hits Malatya province", summary: "At least 5 people were killed when a magnitude 6.1 earthquake struck eastern Turkey, local officials said.", publishedAt: "2026-10-14T09:50:00.000Z" };
  const quake = clusterArticles([...articles, copy], sourceMap).find((e) => e.articleIds.includes("copy"))!;
  const bbc = quake.origins.find((o) => o.key === "outlet:bbc");
  assert.ok(bbc?.sourceIds.includes("independent"), "the later identical article is counted with the original");
});

test("same kind of incident in different places stays separate", () => {
  const extra = [
    { title: "Earthquake strikes off coast of Chile, no tsunami threat", summary: "A magnitude 5.8 earthquake hit near Valparaiso, Chile, officials said.", source: "bbc-world", at: "2026-10-14T10:20:00Z" },
    { title: "Chile earthquake: buildings shake in Valparaiso", summary: "Residents of Valparaiso felt strong shaking after the earthquake.", source: "guardian", at: "2026-10-14T10:50:00Z" },
    { title: "Shooting at Texas high school leaves 2 injured", summary: "Two students were injured in a shooting at a high school in Austin, Texas, police said.", source: "cbs", at: "2026-10-14T15:40:00Z" },
  ].map((e, i) => ({ id: `extra-${i}`, url: `https://x.test/${i}`, title: e.title, summary: e.summary, publishedAt: new Date(e.at).toISOString(), fetchedAt: e.at, language: "en", sourceIds: [e.source] }));

  const events = clusterArticles([...articles, ...extra], sourceMap);
  const eventOf = (id: string) => events.find((e) => e.articleIds.includes(id))!;
  const quake = eventOf(articles.find((a) => expectedEvent.get(a.id) === "quake" && a.sourceIds[0] === "dw")!.id);
  const shooting = eventOf(articles.find((a) => expectedEvent.get(a.id) === "shooting" && a.sourceIds[0] === "npr")!.id);

  assert.equal(eventOf("extra-0"), eventOf("extra-1"), "both Chile reports together");
  assert.notEqual(eventOf("extra-0"), quake, "Chile ≠ Turkey");
  assert.notEqual(eventOf("extra-2"), shooting, "Texas ≠ Ohio");
});
