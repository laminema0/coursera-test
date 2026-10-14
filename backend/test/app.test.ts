import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { NewsService, type ServiceOptions } from "../src/app.ts";
import { createLogger, type LogFields } from "../src/log.ts";
import { loadServiceConfig, type ServiceConfig } from "../src/service-config.ts";
import { SqliteStorage } from "../src/storage/sqlite.ts";
import { MemoryStorage } from "../src/storage/storage.ts";
import { fixtureFetch, fixtureSourceList } from "./fixtures/feeds.ts";
import { testConfig } from "./helpers.ts";

const NOW = new Date("2026-10-14T20:00:00Z");
const sourceList = fixtureSourceList("http://feeds.test");

function service(overrides: Partial<ServiceOptions> & { settings?: Partial<ServiceConfig> } = {}) {
  const lines: LogFields[] = [];
  const { settings, ...rest } = overrides;
  const app = new NewsService({
    config: testConfig({ xBearerToken: "" }),
    service: { ...loadServiceConfig({}), gdelt: false, ...settings },
    sourceList,
    storage: new MemoryStorage(),
    log: createLogger({ level: "debug", write: (line) => lines.push(JSON.parse(line)) }),
    fetch: fixtureFetch(),
    now: () => NOW,
    ...rest,
  });
  return { app, lines };
}

function tempDir(t: { after: (fn: () => void) => void }): string {
  const dir = mkdtempSync(join(tmpdir(), "nv-app-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("a cycle collects, analyzes, publishes and commits once", async () => {
  const storage = new MemoryStorage();
  const { app, lines } = service({ storage });
  assert.equal(app.latestEvents, undefined);
  assert.equal(await app.tick(), "ok");

  assert.ok(app.latestEvents!.events.length >= 4);
  assert.equal(storage.commits, 1);
  assert.equal(storage.load().articles.articles.length, app.articles.articles.size);
  assert.ok(Object.keys(storage.load().history).length > 0);

  const metrics = app.metrics.registry.render();
  assert.match(metrics, /newsverify_cycles_total\{result="ok"\} 1/);
  assert.match(metrics, /newsverify_events\{status="confirmed"\} [1-9]/);
  assert.match(metrics, /newsverify_ready 1/);
  assert.equal(app.metrics.articles.get(), app.articles.articles.size);
  assert.ok(lines.some((l) => l.msg === "analysis" && typeof l.events === "number"));
});

test("one bad feed never breaks the cycle", async () => {
  const fetch = fixtureFetch({
    "/feeds/guardian.xml": () => { throw new TypeError("fetch failed"); },
    "/feeds/npr.xml": () => new Response("<rss><channel><item><title>broken", { status: 200 }),
    "/feeds/dw.xml": () => new Response("upstream down", { status: 502 }),
    "/feeds/cbc.xml": () => new Response("{\"not\": \"a feed\"}", { status: 200 }),
  });
  const { app, lines } = service({ fetch });
  assert.equal(await app.tick(), "ok");
  assert.ok(app.articles.articles.size > 10);
  assert.ok(app.latestEvents!.events.length > 0);
  assert.equal(app.metrics.sourcesUnhealthy.get(), 4);
  for (const id of ["guardian", "npr", "dw", "cbc"]) assert.equal(app.metrics.sourceFailures.get({ source: id }), 1);
  assert.equal(lines.filter((l) => l.msg === "source failed").length, 4);
});

test("the watchdog skips remaining stages after the timeout and reports a stuck cycle", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let gdeltCalls = 0;
  const inner = fixtureFetch();
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input).includes("gdeltproject")) gdeltCalls += 1;
    if (String(input).includes("/feeds/bbc-world.xml")) await gate;
    return inner(input, init);
  }) as typeof globalThis.fetch;

  let stuck = 0;
  const { app } = service({ fetch, settings: { cycleTimeoutMs: 40, gdelt: true }, onStuck: () => (stuck += 1) });
  const result = app.tick();
  assert.equal(await app.tick(), "skipped");
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(stuck, 1);
  release();
  assert.equal(await result, "timeout");
  assert.equal(gdeltCalls, 0);
  assert.equal(app.metrics.cycles.get({ result: "timeout" }), 1);
  // State was still analyzed and saved.
  assert.ok(app.latestEvents);
});

test("GDELT requests are counted", async () => {
  const inner = fixtureFetch();
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input).includes("gdeltproject")) {
      return new Response(JSON.stringify({ articles: [{ domain: "a.test", sourcecountry: "TR", seendate: "20261014T091500Z" }] }));
    }
    return inner(input, init);
  }) as typeof globalThis.fetch;
  const { app } = service({ fetch, settings: { gdelt: true }, gdeltIntervalMs: 0 });
  assert.equal(await app.tick(), "ok");
  assert.ok(app.metrics.gdeltCalls.get({ result: "ok" }) > 0);
  assert.ok(app.latestEvents!.events.some((e) => e.coverage?.outlets === 1));
});

test("restarts from SQLite and is ready before the first collection", async (t) => {
  const file = join(tempDir(t), "news.db");
  const first = service({ storage: new SqliteStorage(file) }).app;
  await first.tick();
  const eventCount = first.latestEvents!.events.length;
  await first.stop("test");

  // Feeds unreachable after the restart: the restored state is still served.
  const offline = (async () => { throw new TypeError("network down"); }) as typeof fetch;
  const second = service({ storage: new SqliteStorage(file), fetch: offline }).app;
  assert.equal(second.articles.articles.size, first.articles.articles.size);
  await second.start(0, "127.0.0.1");
  try {
    assert.equal(second.latestEvents?.events.length, eventCount);
    const port = (second.server.address() as { port: number }).port;
    const ready = await fetch(`http://127.0.0.1:${port}/ready`);
    assert.equal(ready.status, 200);
    const events = await (await fetch(`http://127.0.0.1:${port}/v1/events`)).json() as { events: unknown[] };
    assert.equal(events.events.length, eventCount);
  } finally {
    await second.stop("test");
  }
});

test("graceful stop waits for the running cycle, saves and closes storage", async (t) => {
  const file = join(tempDir(t), "news.db");
  const inner = fixtureFetch();
  const slow = (async (input: string | URL | Request, init?: RequestInit) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return inner(input, init);
  }) as typeof fetch;
  const { app, lines } = service({ storage: new SqliteStorage(file), fetch: slow });
  await app.start(0, "127.0.0.1");
  await new Promise((resolve) => setTimeout(resolve, 10));
  await app.stop("SIGTERM");

  assert.equal(app.server.listening, false);
  assert.ok(lines.some((l) => l.msg === "shutting down" && l.cycle_running === true));
  assert.ok(lines.some((l) => l.msg === "cycle finished" && l.result === "ok"));
  assert.equal(await app.tick(), "skipped");

  const reopened = new SqliteStorage(file);
  assert.equal(reopened.load().articles.articles.length, app.articles.articles.size);
  assert.ok(app.articles.articles.size > 0);
  reopened.close();
});

test("a storage failure is logged and counted, not fatal", async () => {
  const storage = new MemoryStorage();
  storage.commit = () => { throw new Error("disk full"); };
  const { app, lines } = service({ storage });
  assert.equal(await app.tick(), "ok");
  assert.equal(app.metrics.storageErrors.get(), 1);
  assert.ok(lines.some((l) => l.msg === "saving state failed"));
  assert.ok(app.latestEvents);
});
