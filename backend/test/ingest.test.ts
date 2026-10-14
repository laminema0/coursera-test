import assert from "node:assert/strict";
import { test } from "node:test";
import { DailyBudget } from "../src/budget.ts";
import { buildFeed } from "../src/feed.ts";
import { Ingestor } from "../src/ingest.ts";
import { MemoryStore } from "../src/store.ts";
import { XClient } from "../src/x/client.ts";
import { Clock, fakeX, post, testConfig, user } from "./helpers.ts";
import type { Config } from "../src/config.ts";

function setup(configOverrides: Partial<Config> = {}) {
  const config = testConfig(configOverrides);
  const clock = new Clock("2026-10-14T10:00:00Z");
  const x = fakeX();
  x.users.set("u1", user("u1", "Reuters"));
  x.users.set("u2", user("u2", "AP"));
  const store = new MemoryStore();
  const budget = new DailyBudget(config.dailyBudgetUsd, config.prices, clock.now);
  const ingestor = new Ingestor({
    config,
    client: new XClient({ bearerToken: config.xBearerToken, baseUrl: config.xApiBaseUrl, fetch: x.fetch }),
    store,
    budget,
    now: clock.now,
    fetchMetadata: async (url) => ({ title: `Title for ${url}`, imageUrl: "https://img.test/lead.jpg" }),
  });
  return { config, clock, x, store, budget, ingestor };
}

test("first poll groups posts about the same article into one story", async () => {
  const { x, store, ingestor, clock } = setup();
  x.searchResults = [
    post("103", "u2", "https://www.apnews.com/article/quake?utm_source=x"),
    post("102", "u1", "https://reuters.com/world/quake/"),
    post("101", "u1", "https://reuters.com/world/quake"),
  ];

  const report = await ingestor.runCycle();

  assert.equal(report.newPosts, 3);
  assert.equal(store.stories.size, 2);
  assert.equal(report.profilesRefreshed, 2);
  assert.equal(report.storiesEnriched, 2);
  assert.ok(Math.abs(report.spentTodayUsd - (3 * 0.005 + 2 * 0.01)) < 1e-9);

  const search = x.requests.find((u) => u.pathname.endsWith("/search/recent"));
  assert.ok(search);
  assert.equal(search.searchParams.get("query"), "(from:Reuters OR from:AP) has:links -is:retweet -is:reply");
  assert.equal(search.searchParams.get("start_time"), new Date(clock.current.getTime() - 120 * 60_000).toISOString());
  assert.equal(search.searchParams.get("since_id"), null);
});

test("next poll asks only for newer posts and respects the poll interval", async () => {
  const { x, ingestor, clock } = setup();
  x.searchResults = [post("101", "u1", "https://reuters.com/a")];
  await ingestor.runCycle();

  x.requests.length = 0;
  clock.advanceMinutes(1);
  await ingestor.runCycle();
  assert.equal(x.requests.filter((u) => u.pathname.endsWith("/search/recent")).length, 0, "not due yet");

  clock.advanceMinutes(5);
  x.searchResults = [post("102", "u1", "https://reuters.com/b"), ...x.searchResults];
  const report = await ingestor.runCycle();
  const search = x.requests.find((u) => u.pathname.endsWith("/search/recent"));
  assert.equal(search?.searchParams.get("since_id"), "101");
  assert.equal(report.newPosts, 1);
});

test("compliance removes posts deleted on X and reports them to clients", async () => {
  const { x, store, ingestor, clock } = setup();
  x.searchResults = [post("102", "u1", "https://reuters.com/b"), post("101", "u1", "https://reuters.com/a")];
  await ingestor.runCycle();
  const before = clock.current;

  x.alive.delete("101");
  clock.advanceMinutes(61);
  const report = await ingestor.runCycle();

  assert.equal(report.compliance.deleted, 1);
  assert.equal(store.posts.has("101"), false);
  assert.equal(store.stories.size, 1, "story without posts is dropped");
  const feed = buildFeed(store, { since: before, limit: 50, now: clock.current });
  assert.deepEqual(feed.removed_post_ids, ["101"]);
  assert.deepEqual(feed.stories.flatMap((s) => s.posts.map((p) => p.id)), ["102"]);
});

test("re-checking posts read earlier the same UTC day costs nothing", async () => {
  const { x, ingestor, clock, budget } = setup();
  x.searchResults = [post("101", "u1", "https://reuters.com/a")];
  await ingestor.runCycle();
  const spent = budget.spentUsd;

  clock.advanceMinutes(61);
  const report = await ingestor.runCycle();
  assert.equal(report.compliance.checked, 1);
  assert.equal(budget.spentUsd, spent);
});

test("when the budget can't pay for compliance, posts are removed instead of shown unverified", async () => {
  const { x, store, ingestor, clock, budget } = setup({ dailyBudgetUsd: 0.06 });
  x.searchResults = [post("101", "u1", "https://reuters.com/a")];
  clock.current = new Date("2026-10-14T23:30:00Z");
  await ingestor.runCycle();
  assert.equal(store.posts.size, 1);

  // New UTC day: re-reading the post is billable again. Exhaust today's budget first.
  clock.current = new Date("2026-10-15T00:31:00Z");
  budget.record("post", Array.from({ length: 12 }, (_, i) => `spent-${i}`));
  const report = await ingestor.runCycle();

  assert.equal(report.compliance.unverifiable, 1);
  assert.equal(store.posts.size, 0);
  assert.deepEqual(report.skippedForBudget, ["news"]);
});

test("posts expire after the retention window", async () => {
  const { x, store, ingestor, clock } = setup({ retentionHours: 2 });
  x.searchResults = [post("101", "u1", "https://reuters.com/a")];
  await ingestor.runCycle();
  clock.advanceMinutes(121);
  const report = await ingestor.runCycle();
  assert.equal(report.compliance.expired, 1);
  assert.equal(store.posts.size, 0);
});

test("a 429 pauses all X calls until the reset time", async () => {
  const { x, store, ingestor, clock } = setup();
  x.rateLimitNext = true;
  x.rateLimitResetAt = new Date("2026-10-14T10:15:00Z");
  const report = await ingestor.runCycle();
  assert.equal(report.rateLimitedUntil, "2026-10-14T10:15:00.000Z");

  x.requests.length = 0;
  clock.advanceMinutes(10);
  await ingestor.runCycle();
  assert.equal(x.requests.length, 0);
  assert.ok(store.pausedUntil);
});

test("feed hides posts whose author profile is unknown and links back to X", async () => {
  const { x, store, ingestor, clock } = setup();
  x.searchResults = [post("101", "u1", "https://reuters.com/a")];
  await ingestor.runCycle();
  let feed = buildFeed(store, { limit: 50, now: clock.current });
  assert.equal(feed.stories[0]?.posts[0]?.permalink, "https://x.com/Reuters/status/101");

  store.users.clear();
  feed = buildFeed(store, { limit: 50, now: clock.current });
  assert.equal(feed.stories.length, 0);
});

test("snapshot round-trips the store", async () => {
  const { x, store, ingestor } = setup();
  x.searchResults = [post("101", "u1", "https://reuters.com/a")];
  await ingestor.runCycle();
  const restored = MemoryStore.restore(JSON.parse(JSON.stringify(store.snapshot())));
  const asJson = (value: unknown) => JSON.parse(JSON.stringify(value));
  assert.deepEqual(asJson(restored.snapshot()), asJson(store.snapshot()));
});

test("skips polling when the budget can't cover X's minimum of 10 search results", async () => {
  const { x, ingestor } = setup({ dailyBudgetUsd: 0.045 });
  x.searchResults = [post("101", "u1", "https://reuters.com/a")];
  const report = await ingestor.runCycle();
  assert.deepEqual(report.skippedForBudget, ["news"]);
  assert.equal(x.requests.length, 0);
});
