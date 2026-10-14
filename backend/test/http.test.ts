import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import { analyze } from "../src/analysis/verify.ts";
import { type EventsResponse, toApiEvents } from "../src/events-api.ts";
import { createLogger } from "../src/log.ts";
import { createMetrics } from "../src/metrics.ts";
import { RateLimiter } from "../src/rate-limit.ts";
import { acceptsGzip, type ApiDeps, createApiServer, matchesEtag } from "../src/server.ts";
import { ArticleStore } from "../src/sources/article-store.ts";
import { articles, sourceMap, sources } from "./fixtures/breaking.ts";

const store = new ArticleStore();
for (const a of articles) store.articles.set(a.id, a);
const fixtureEvents = toApiEvents(analyze(articles, sourceMap), store.articles, sourceMap, new Date("2026-10-14T20:00:00Z"));

interface Raw { status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }

/** Raw HTTP (fetch would transparently decompress and hide Content-Encoding). */
function raw(port: number, path: string, options: { method?: string; headers?: Record<string, string> } = {}): Promise<Raw> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port, path, method: options.method ?? "GET", headers: options.headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function withServer(deps: Partial<ApiDeps>, fn: (port: number) => Promise<void>): Promise<void> {
  const server = createApiServer({ articles: store, sources, events: () => fixtureEvents, ...deps }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await fn((server.address() as AddressInfo).port);
  } finally {
    server.close();
  }
}

test("/v1/events supports ETag / If-None-Match and keeps the JSON contract", async () => {
  await withServer({}, async (port) => {
    const first = await raw(port, "/v1/events");
    assert.equal(first.status, 200);
    const etag = String(first.headers.etag);
    assert.match(etag, /^W\/"[\w-]+"$/);
    const body = JSON.parse(first.body.toString()) as EventsResponse;
    assert.deepEqual(Object.keys(body), ["generated_at", "events"]);
    // Same payload as before compression/caching was added (default sort: importance, limit 100).
    const expected = [...fixtureEvents.events].sort((a, b) => b.importance - a.importance);
    assert.deepEqual(body, JSON.parse(JSON.stringify({ ...fixtureEvents, events: expected })));

    const again = await raw(port, "/v1/events", { headers: { "If-None-Match": etag } });
    assert.equal(again.status, 304);
    assert.equal(again.body.length, 0);
    assert.equal(again.headers.etag, etag);

    const stale = await raw(port, "/v1/events", { headers: { "If-None-Match": 'W/"other"' } });
    assert.equal(stale.status, 200);

    const filtered = await raw(port, "/v1/events?status=disputed", { headers: { "If-None-Match": etag } });
    assert.equal(filtered.status, 200);
    assert.notEqual(filtered.headers.etag, etag);
  });
});

test("the ETag changes when a new analysis result is published", async () => {
  let current = fixtureEvents;
  await withServer({ events: () => current }, async (port) => {
    const a = (await raw(port, "/v1/events")).headers.etag;
    current = { ...fixtureEvents, generated_at: "2026-10-14T20:01:00.000Z" };
    const b = (await raw(port, "/v1/events")).headers.etag;
    assert.notEqual(a, b);
  });
});

test("responses are gzip-compressed when the client accepts it", async () => {
  await withServer({}, async (port) => {
    const plain = await raw(port, "/v1/events");
    const gz = await raw(port, "/v1/events", { headers: { "Accept-Encoding": "gzip, deflate, br" } });
    assert.equal(gz.headers["content-encoding"], "gzip");
    assert.equal(gz.headers.vary, "Accept-Encoding");
    assert.ok(gz.body.length < plain.body.length);
    assert.deepEqual(gunzipSync(gz.body), plain.body);
    assert.equal(gz.headers.etag, plain.headers.etag);

    const refused = await raw(port, "/v1/events", { headers: { "Accept-Encoding": "gzip;q=0" } });
    assert.equal(refused.headers["content-encoding"], undefined);
    // Small bodies aren't compressed.
    const small = await raw(port, "/v1/events?status=nothing", { headers: { "Accept-Encoding": "gzip" } });
    assert.equal(small.headers["content-encoding"], undefined);
  });
});

test("CORS is off by default and can be enabled per origin", async () => {
  await withServer({}, async (port) => {
    const res = await raw(port, "/v1/events", { headers: { Origin: "https://evil.test" } });
    assert.equal(res.headers["access-control-allow-origin"], undefined);
    assert.equal((await raw(port, "/v1/events", { method: "OPTIONS", headers: { Origin: "https://evil.test" } })).status, 405);
  });
  await withServer({ corsOrigins: ["https://app.test"] }, async (port) => {
    const ok = await raw(port, "/v1/events", { headers: { Origin: "https://app.test" } });
    assert.equal(ok.headers["access-control-allow-origin"], "https://app.test");
    assert.match(String(ok.headers.vary), /Origin/);
    const other = await raw(port, "/v1/events", { headers: { Origin: "https://evil.test" } });
    assert.equal(other.headers["access-control-allow-origin"], undefined);
    const preflight = await raw(port, "/v1/events", { method: "OPTIONS", headers: { Origin: "https://app.test" } });
    assert.equal(preflight.status, 204);
    assert.match(String(preflight.headers["access-control-allow-methods"]), /GET/);
  });
});

test("/health is liveness, /ready waits for the first analysis", async () => {
  let events: EventsResponse | undefined;
  await withServer({ events: () => events }, async (port) => {
    assert.equal((await raw(port, "/health")).status, 200);
    const notReady = await raw(port, "/ready");
    assert.equal(notReady.status, 503);
    assert.equal((await raw(port, "/v1/events")).status, 503);
    events = fixtureEvents;
    const ready = await raw(port, "/ready");
    assert.equal(ready.status, 200);
    assert.equal(JSON.parse(ready.body.toString()).ready, true);
  });
});

test("/metrics is served to private-network scrapers, not through the tunnel without a token", async () => {
  const metrics = createMetrics();
  await withServer({ metrics, metricsToken: "s3cret" }, async (port) => {
    await raw(port, "/v1/events");
    const local = await raw(port, "/metrics");
    assert.equal(local.status, 200);
    assert.match(String(local.headers["content-type"]), /^text\/plain; version=0.0.4/);
    assert.match(local.body.toString(), /newsverify_http_requests_total\{route="\/v1\/events",method="GET",status="200"\} 1/);

    assert.equal((await raw(port, "/metrics", { headers: { "CF-Connecting-IP": "203.0.113.9" } })).status, 404);
    assert.equal((await raw(port, "/metrics", { headers: { "CF-Connecting-IP": "203.0.113.9", Authorization: "Bearer wrong!" } })).status, 404);
    assert.equal((await raw(port, "/metrics", { headers: { "CF-Connecting-IP": "203.0.113.9", Authorization: "Bearer s3cret" } })).status, 200);
  });
  await withServer({}, async (port) => assert.equal((await raw(port, "/metrics")).status, 404));
});

test("rate limiting counts 429s and never applies to health checks", async () => {
  const metrics = createMetrics();
  await withServer({ metrics, rateLimiter: new RateLimiter(1) }, async (port) => {
    assert.equal((await raw(port, "/v1/sources")).status, 200);
    const limited = await raw(port, "/v1/sources");
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers["retry-after"]) > 0);
    assert.equal((await raw(port, "/health")).status, 200);
    assert.equal((await raw(port, "/ready")).status, 200);
    assert.equal(metrics.httpRateLimited.get(), 1);
  });
});

test("HEAD works, other methods get 405, and every request is logged", async () => {
  const lines: Record<string, unknown>[] = [];
  const log = createLogger({ level: "debug", write: (line) => lines.push(JSON.parse(line)) });
  await withServer({ log }, async (port) => {
    const head = await raw(port, "/v1/events", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.body.length, 0);
    assert.ok(Number(head.headers["content-length"]) > 0);
    const post = await raw(port, "/v1/events", { method: "POST" });
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, "GET, HEAD");
    await raw(port, "/v1/events?limit=1");
  });
  await new Promise((resolve) => setImmediate(resolve));
  const http = lines.filter((l) => l.msg === "http");
  assert.equal(http.length, 3);
  assert.deepEqual(http.map((l) => [l.method, l.status]), [["HEAD", 200], ["POST", 405], ["GET", 200]]);
  assert.equal(http[2]!.query, "?limit=1");
  assert.equal(http[2]!.client, "127.0.0.1");
});

test("ETag and Accept-Encoding parsing", () => {
  assert.ok(matchesEtag('W/"a", "b"', '"b"'));
  assert.ok(matchesEtag('"a"', 'W/"a"'));
  assert.ok(matchesEtag("*", 'W/"a"'));
  assert.ok(!matchesEtag(undefined, 'W/"a"'));
  assert.ok(acceptsGzip("br, gzip;q=0.5"));
  assert.ok(acceptsGzip("*"));
  assert.ok(!acceptsGzip("br"));
  assert.ok(!acceptsGzip("gzip; q=0"));
});
