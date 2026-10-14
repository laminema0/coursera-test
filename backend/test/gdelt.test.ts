import assert from "node:assert/strict";
import { test } from "node:test";
import { CoverageTracker, fetchCoverage, gdeltQueryFor, parseSeenDate } from "../src/sources/gdelt.ts";
import { Clock } from "./helpers.ts";

test("builds a GDELT query from proper nouns and a keyword", () => {
  assert.equal(gdeltQueryFor("Turkey earthquake: Strong quake hits Malatya province"), "Malatya Turkey earthquake sourcelang:english");
  assert.equal(gdeltQueryFor("Police: 3 dead, 8 injured in Columbus mall shooting; suspect arrested"), "Columbus injured shooting sourcelang:english");
  assert.equal(gdeltQueryFor("Ruritania finance minister Karl Weber says country will default on its debt"), "Karl Weber Ruritania finance sourcelang:english");
  assert.equal(gdeltQueryFor("Breaking"), undefined);
});

test("parses GDELT dates", () => {
  assert.equal(parseSeenDate("20261014T091500Z"), "2026-10-14T09:15:00.000Z");
  assert.equal(parseSeenDate("nope"), undefined);
});

const gdeltResponse = {
  articles: [
    { url: "https://a.test/1", domain: "a.test", sourcecountry: "Turkey", seendate: "20261014T093000Z" },
    { url: "https://a.test/2", domain: "a.test", sourcecountry: "Turkey", seendate: "20261014T100000Z" },
    { url: "https://b.test/1", domain: "b.test", sourcecountry: "United Kingdom", seendate: "20261014T091500Z" },
    { url: "https://c.test/1", domain: "c.test", sourcecountry: "United States", seendate: "20261014T094500Z" },
  ],
};

test("counts unique outlets and countries", async () => {
  const requested: string[] = [];
  const coverage = await fetchCoverage("Malatya earthquake", async (url) => {
    requested.push(String(url));
    return new Response(JSON.stringify(gdeltResponse));
  }, new Date("2026-10-14T12:00:00Z"));
  assert.deepEqual(coverage, { query: "Malatya earthquake", outlets: 3, countries: 3, firstSeenAt: "2026-10-14T09:15:00.000Z", checkedAt: "2026-10-14T12:00:00.000Z" });
  const url = new URL(requested[0]!);
  assert.equal(url.searchParams.get("mode"), "ArtList");
  assert.equal(url.searchParams.get("timespan"), "24h");
});

test("plain-text error answers become errors", async () => {
  await assert.rejects(fetchCoverage("x", async () => new Response("Your search contained a keyword that was too short")), /too short/);
});

test("tracker spaces requests, caches results and retries failures next time", async () => {
  const clock = new Clock("2026-10-14T12:00:00Z");
  const sleeps: number[] = [];
  let calls = 0;
  let failNext = true;
  const tracker = new CoverageTracker({
    now: clock.now,
    sleep: async (ms) => { sleeps.push(ms); },
    fetch: async () => {
      calls += 1;
      if (failNext) { failNext = false; return new Response("busy", { status: 429 }); }
      return new Response(JSON.stringify(gdeltResponse));
    },
  });
  const events = [{ id: "e1", title: "Turkey earthquake hits Malatya" }, { id: "e2", title: "Columbus mall shooting in Ohio" }];

  assert.equal(await tracker.refresh(events, 5), 1);
  assert.deepEqual(sleeps, [6_000]);
  assert.equal(tracker.get("e1"), undefined, "failed request is not cached");
  assert.equal(tracker.get("e2")?.outlets, 3);

  calls = 0;
  await tracker.refresh(events, 5);
  assert.equal(calls, 1, "only the missing one is fetched");

  clock.advanceMinutes(16);
  calls = 0;
  await tracker.refresh(events, 1);
  assert.equal(calls, 1, "stale entries refresh, limited by max");

  tracker.retain(new Set(["e2"]));
  assert.equal(tracker.get("e1"), undefined);
});
