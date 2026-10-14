import assert from "node:assert/strict";
import { test } from "node:test";
import { clusterArticles } from "../src/analysis/cluster.ts";
import { stem, tokenize } from "../src/analysis/text.ts";
import { articles, expectedEvent, sourceMap } from "./fixtures/breaking.ts";

test("tokenize drops stop words and numbers and stems", () => {
  assert.deepEqual(tokenize("Earthquake kills 12 people in Turkey's Malatya, officials said"), ["earthquake", "kill", "people", "turkey", "malatya", "official"]);
  assert.equal(stem("injuries"), "injury");
  assert.equal(stem("crisis"), "crisis");
  assert.equal(stem("winning"), "win");
  assert.equal(stem("stopped"), "stop");
  assert.equal(stem("falling"), "fall");
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

test("different stories about the same place stay separate", () => {
  const extra = [
    { title: "Malatya mayoral election: opposition candidate claims victory", summary: "The opposition candidate declared victory in the Malatya mayoral race after counting ended.", source: "guardian", at: "2026-10-14T18:00:00Z" },
    { title: "Opposition wins Malatya mayor vote, results show", summary: "Results showed the opposition party winning the mayoral election in Malatya.", source: "dw", at: "2026-10-14T18:30:00Z" },
  ].map((e, i) => ({ id: `vote-${i}`, url: `https://v.test/${i}`, title: e.title, summary: e.summary, publishedAt: new Date(e.at).toISOString(), fetchedAt: e.at, language: "en", sourceIds: [e.source] }));

  const events = clusterArticles([...articles, ...extra], sourceMap);
  const eventOf = (id: string) => events.find((e) => e.articleIds.includes(id))!;
  const quake = eventOf(articles.find((a) => expectedEvent.get(a.id) === "quake" && a.sourceIds[0] === "dw")!.id);
  assert.equal(eventOf("vote-0"), eventOf("vote-1"), "both election reports together");
  assert.notEqual(eventOf("vote-0"), quake, "election ≠ earthquake");
});

test("a wire's own account and credits to that wire elsewhere are one origin", async () => {
  const { originOf } = await import("../src/analysis/origin.ts");
  const apSource = { id: "ap-bluesky", name: "AP", url: "", format: "bluesky" as const, tier: 1 as const, owner: "ap", country: "US", pollMinutes: 5 };
  const own = originOf({ ...articles[0]!, title: "Strong earthquake hits eastern Turkey", summary: undefined }, apSource);
  const credited = originOf({ ...articles[0]!, title: "Earthquake hits Turkey (AP)", summary: undefined }, sourceMap.get("cbs")!);
  assert.deepEqual(own, { key: "wire:ap", kind: "wire" });
  assert.deepEqual(credited, own);
});

const at = (minutes: number) => new Date(Date.parse("2026-10-14T10:00:00Z") + minutes * 60_000).toISOString();
const item = (id: string, source: string, minutes: number, title: string, summary?: string) =>
  ({ id, url: `https://${source}.test/${id}`, title, summary, publishedAt: at(minutes), fetchedAt: at(minutes), language: "en", sourceIds: [source] });

test("machine titles, demonyms and synonym families normalize", () => {
  assert.deepEqual(tokenize("M 6.8 - 41 km SSW of Arequipa, Peru"), ["magnitude", "arequipa", "peru", "6.8"]);
  assert.deepEqual(tokenize("Orange earthquake alert (Magnitude 6.8M, Depth:35km)"), ["orange", "earthquake", "alert", "magnitude", "6.8"]);
  assert.deepEqual(tokenize("Kenyan police fire tear gas at protesters"), ["kenya", "police", "fire", "tear", "gas", "protest"]);
  assert.deepEqual(tokenize("Typhoon forces evacuation; 2,000 evacuated"), ["cyclone", "force", "evacuat", "evacuat"]);
});

test("same place, different incident: a ferry sinking doesn't join the earthquake", () => {
  const items = [
    item("q1", "bbc-world", 0, "Indonesia earthquake: 3 dead in Mamuju on Sulawesi island", "A magnitude 6.2 earthquake struck West Sulawesi, Indonesia's disaster agency said."),
    item("q2", "guardian", 30, "Sulawesi earthquake kills 7 in Indonesia", "Seven people were killed in Mamuju on Sulawesi after the earthquake."),
    item("f1", "npr", 300, "Ferry capsizes off Indonesia's Sulawesi island, 30 missing", "A ferry capsized off Sulawesi, Indonesia, with 30 people missing, the rescue agency said."),
    item("f2", "dw", 330, "Indonesia ferry disaster: 9 dead off Sulawesi", "Nine people died after the ferry capsized off Sulawesi island in Indonesia."),
  ];
  const events = clusterArticles(items, sourceMap);
  const eventOf = (id: string) => events.find((e) => e.articleIds.includes(id))!;
  assert.equal(eventOf("q1"), eventOf("q2"));
  assert.equal(eventOf("f1"), eventOf("f2"));
  assert.notEqual(eventOf("q1"), eventOf("f1"));
});

test("a big event doesn't absorb short unrelated posts made of common words", () => {
  const big = Array.from({ length: 30 }, (_, i) =>
    item(`b${i}`, i % 2 ? "guardian" : "bbc-world", i * 10, `Hurricane Lorena: people killed as storm hits Florida, officials said (${i})`, `Officials said people were killed and homes damaged as Hurricane Lorena hit Florida, update ${i}.`));
  const post = item("p1", "reddit", 400, "People in our town said officials killed the park plan");
  const events = clusterArticles([...big, post], sourceMap);
  assert.notEqual(events.find((e) => e.articleIds.includes("p1")), events.find((e) => e.articleIds.includes("b0")));
});
