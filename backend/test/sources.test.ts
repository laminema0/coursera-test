import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ArticleStore } from "../src/sources/article-store.ts";
import { Collector } from "../src/sources/collector.ts";
import { parseFeed, parseUsgsGeoJson } from "../src/sources/parse.ts";
import type { NewsSource, SourceList } from "../src/sources/types.ts";
import { Clock } from "./helpers.ts";

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>T</title>
  <item><title>Quake &amp; aftershocks</title><link>https://news.test/world/quake?utm_source=rss</link>
    <description><![CDATA[<p>At least <b>12</b> people were killed, officials said.</p>]]></description>
    <pubDate>Tue, 14 Oct 2026 09:00:00 GMT</pubDate></item>
  <item><title>No date</title><guid>https://news.test/world/other</guid></item>
  <item><title></title><link>https://news.test/empty-title</link></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title type="html">Minister &lt;i&gt;says&lt;/i&gt;</title>
    <link rel="self" href="https://gov.test/api/1"/><link rel="alternate" href="https://gov.test/news/1"/>
    <summary>Statement on the border.</summary><updated>2026-10-14T08:30:00Z</updated></entry>
</feed>`;

const RDF = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <item><title>DW item</title><link>https://dw.test/a</link><dc:date>2026-10-14T07:00:00Z</dc:date></item>
</rdf:RDF>`;

const USGS = JSON.stringify({ features: [{ properties: { title: "M 6.1 - 20 km S of Town", place: "20 km S of Town", mag: 6.1, time: Date.parse("2026-10-14T09:10:00Z"), url: "https://earthquake.usgs.gov/earthquakes/eventpage/us1", alert: "yellow", tsunami: 1 } }] });

test("parses RSS 2.0: decodes entities, strips HTML, falls back to guid, drops untitled items", () => {
  assert.deepEqual(parseFeed(RSS), [
    { url: "https://news.test/world/quake?utm_source=rss", title: "Quake & aftershocks", summary: "At least 12 people were killed, officials said.", publishedAt: "2026-10-14T09:00:00.000Z" },
    { url: "https://news.test/world/other", title: "No date", summary: undefined, publishedAt: undefined },
  ]);
});

test("parses Atom (alternate link) and RSS 1.0/RDF", () => {
  assert.deepEqual(parseFeed(ATOM), [
    { url: "https://gov.test/news/1", title: "Minister says", summary: "Statement on the border.", publishedAt: "2026-10-14T08:30:00.000Z" },
  ]);
  assert.equal(parseFeed(RDF)[0]?.publishedAt, "2026-10-14T07:00:00.000Z");
  assert.deepEqual(parseFeed("<html><body>not a feed</body></html>"), []);
});

test("cuts long descriptions to a short summary", () => {
  const long = `<rss><channel><item><title>A</title><link>https://a.test/1</link><description>${"word ".repeat(200)}</description></item></channel></rss>`;
  const summary = parseFeed(long)[0]?.summary ?? "";
  assert.ok(summary.length <= 301 && summary.endsWith("…"), summary);
});

test("parses USGS GeoJSON as a primary source", () => {
  assert.deepEqual(parseUsgsGeoJson(USGS), [{
    url: "https://earthquake.usgs.gov/earthquakes/eventpage/us1",
    title: "M 6.1 - 20 km S of Town",
    summary: "Magnitude 6.1 · 20 km S of Town · PAGER alert: yellow · Tsunami flag set",
    publishedAt: "2026-10-14T09:10:00.000Z",
  }]);
});

function source(id: string, url: string, overrides: Partial<NewsSource> = {}): NewsSource {
  return { id, name: id, url, format: "rss", tier: 1, owner: id, country: "GB", pollMinutes: 10, ...overrides };
}

function fakeFeeds(routes: Record<string, () => Response>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const route = routes[url];
    return route ? route() : new Response("missing", { status: 404 });
  };
  return { calls, fetch: fetchImpl };
}

test("collects articles, merges the same article from two feeds, and uses conditional GET", async () => {
  const clock = new Clock("2026-10-14T10:00:00Z");
  const feeds = fakeFeeds({
    "https://bbc.test/world": () => new Response(RSS, { headers: { ETag: '"v1"' } }),
    "https://bbc.test/top": () => new Response(RSS),
  });
  const store = new ArticleStore();
  const collector = new Collector({
    sources: [source("bbc-world", "https://bbc.test/world", { owner: "bbc" }), source("bbc-top", "https://bbc.test/top", { owner: "bbc" })],
    language: "en",
    store,
    fetch: feeds.fetch,
    now: clock.now,
  });

  const first = await collector.runCycle();
  assert.equal(first.newArticles, 2);
  assert.equal(store.articles.size, 2);
  const quake = [...store.articles.values()].find((a) => a.title.startsWith("Quake"));
  assert.equal(quake?.url, "https://news.test/world/quake", "tracking params removed");
  assert.deepEqual(quake?.sourceIds.sort(), ["bbc-top", "bbc-world"]);
  assert.equal(store.articles.get(quake!.id)?.publishedAt, "2026-10-14T09:00:00.000Z");

  feeds.calls.length = 0;
  clock.advanceMinutes(5);
  await collector.runCycle();
  assert.equal(feeds.calls.length, 0, "not due yet");

  clock.advanceMinutes(5);
  await collector.runCycle();
  const worldCall = feeds.calls.find((c) => c.url === "https://bbc.test/world");
  assert.equal(worldCall?.headers["If-None-Match"], '"v1"');
});

test("304 Not Modified is a success; failures back off exponentially", async () => {
  const clock = new Clock("2026-10-14T10:00:00Z");
  const feeds = fakeFeeds({
    "https://a.test/feed": () => new Response(null, { status: 304 }),
    "https://broken.test/feed": () => new Response("<html>oops</html>", { status: 200 }),
  });
  const store = new ArticleStore();
  const collector = new Collector({
    sources: [source("a", "https://a.test/feed"), source("broken", "https://broken.test/feed")],
    language: "en",
    store,
    fetch: feeds.fetch,
    now: clock.now,
  });

  const report = await collector.runCycle();
  assert.equal(report.notModified, 1);
  assert.deepEqual(report.failed.map((f) => f.sourceId), ["broken"]);
  assert.equal(store.state("broken").nextFetchAt, "2026-10-14T10:20:00.000Z", "10 min × 2^1");
  await collector.runCycle();
  clock.advanceMinutes(20);
  await collector.runCycle();
  assert.equal(store.state("broken").consecutiveFailures, 2);
  assert.equal(store.state("broken").nextFetchAt, "2026-10-14T11:00:00.000Z", "10 min × 2^2");
});

test("drops articles after the retention window and ignores future publish dates", async () => {
  const clock = new Clock("2026-10-14T10:00:00Z");
  const future = RSS.replace("Tue, 14 Oct 2026 09:00:00 GMT", "Tue, 14 Oct 2031 09:00:00 GMT");
  const feeds = fakeFeeds({ "https://a.test/feed": () => new Response(future) });
  const store = new ArticleStore();
  const collector = new Collector({ sources: [source("a", "https://a.test/feed")], language: "en", store, fetch: feeds.fetch, now: clock.now, retentionHours: 1 });

  await collector.runCycle();
  assert.ok([...store.articles.values()].every((a) => a.publishedAt === "2026-10-14T10:00:00.000Z"));
  clock.advanceMinutes(61);
  const report = await collector.runCycle();
  assert.equal(report.expired, 2);
});

test("the English source list is well-formed", () => {
  const list = JSON.parse(readFileSync(new URL("../sources/en.json", import.meta.url), "utf8")) as SourceList;
  assert.equal(list.language, "en");
  assert.ok(list.sources.length >= 50);
  const ids = new Set<string>();
  for (const s of list.sources) {
    assert.ok(!ids.has(s.id), `duplicate id ${s.id}`);
    ids.add(s.id);
    assert.ok(new URL(s.url).protocol === "https:", `${s.id} must use https`);
    assert.ok([1, 2, "primary", "signal"].includes(s.tier), `${s.id} tier`);
    assert.ok(s.owner && s.country && s.pollMinutes >= 5, `${s.id} fields`);
  }
});
