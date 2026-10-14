import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { analyze } from "../src/analysis/verify.ts";
import { toApiEvents } from "../src/events-api.ts";
import { createApiServer } from "../src/server.ts";
import { ArticleStore } from "../src/sources/article-store.ts";
import { articles, sourceMap, sources } from "./fixtures/breaking.ts";

test("GET /v1/events serves verified events with filters", async () => {
  const store = new ArticleStore();
  for (const a of articles) store.articles.set(a.id, a);
  const events = toApiEvents(analyze(articles, sourceMap), store.articles, sourceMap, new Date("2026-10-14T20:00:00Z"));
  const server = createApiServer({ articles: store, sources, events: () => events }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const all = await (await fetch(`${base}/v1/events`)).json() as typeof events;
    assert.ok(all.events.length >= 4);
    const quake = all.events.find((e) => e.title.includes("Malatya"))!;
    assert.equal(quake.verification.status, "confirmed");
    assert.ok(quake.origins.some((o) => o.articles.some((a) => a.source_name === "usgs")));
    assert.equal(quake.numbers[0]?.kind, "killed");

    const disputed = await (await fetch(`${base}/v1/events?status=disputed`)).json() as typeof events;
    assert.deepEqual(disputed.events.map((e) => e.verification.status), ["disputed"]);

    const sourcesResponse = await (await fetch(`${base}/v1/sources`)).json() as { sources: { id: string; healthy: boolean }[] };
    assert.equal(sourcesResponse.sources.length, sources.length);
  } finally {
    server.close();
  }
});
