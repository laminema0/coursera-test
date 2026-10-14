import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import { test } from "node:test";
import { createLogger, parseLogLevel } from "../src/log.ts";
import { Counter, createMetrics, Gauge, Histogram, Registry } from "../src/metrics.ts";
import { clientOf, isPrivate } from "../src/rate-limit.ts";
import { loadServiceConfig } from "../src/service-config.ts";

test("logger writes one JSON object per line and respects the level", () => {
  const lines: string[] = [];
  const log = createLogger({ level: "info", write: (line) => lines.push(line), now: () => new Date("2026-10-14T10:00:00Z") });
  log.debug("hidden");
  log.info("cycle finished", { ms: 12 });
  log.child({ component: "http" }).error("failed", { error: new Error("boom") });
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[0]!), { ts: "2026-10-14T10:00:00.000Z", level: "info", msg: "cycle finished", ms: 12 });
  const err = JSON.parse(lines[1]!);
  assert.equal(err.component, "http");
  assert.equal(err.error.message, "boom");
  assert.equal(log.enabled("debug"), false);
});

test("LOG_LEVEL parsing falls back to info", () => {
  assert.equal(parseLogLevel("DEBUG"), "debug");
  assert.equal(parseLogLevel("verbose"), "info");
  assert.equal(parseLogLevel(undefined), "info");
});

test("metrics render in Prometheus text format", () => {
  const registry = new Registry();
  const c = registry.register(new Counter("x_total", "Things."));
  const g = registry.register(new Gauge("y", "Level."));
  const h = registry.register(new Histogram("z_seconds", "Time.", [0.1, 1]));
  c.inc({ route: "/v1/events", status: "200" });
  c.inc({ status: "200", route: "/v1/events" }, 2);
  g.set(3, { label: 'a"b' });
  h.observe(0.5);
  h.observe(5);
  assert.equal(registry.render(), [
    "# HELP x_total Things.", "# TYPE x_total counter", 'x_total{route="/v1/events",status="200"} 3',
    "# HELP y Level.", "# TYPE y gauge", 'y{label="a\\"b"} 3',
    "# HELP z_seconds Time.", "# TYPE z_seconds histogram",
    'z_seconds_bucket{le="0.1"} 0', 'z_seconds_bucket{le="1"} 1', 'z_seconds_bucket{le="+Inf"} 2', "z_seconds_sum 5.5", "z_seconds_count 2",
  ].join("\n") + "\n");
  g.replace([{ labels: { status: "confirmed" }, value: 1 }]);
  assert.equal(g.get({ label: 'a"b' }), undefined);
});

test("the service registers the documented series", () => {
  const text = createMetrics().registry.render();
  for (const name of ["newsverify_cycle_duration_seconds", "newsverify_articles", "newsverify_events", "newsverify_source_failures_total", "newsverify_gdelt_requests_total", "newsverify_http_requests_total", "newsverify_http_rate_limited_total"]) {
    assert.match(text, new RegExp(`# TYPE ${name} `));
  }
});

const request = (remoteAddress: string, headers: Record<string, string> = {}) => ({ socket: { remoteAddress }, headers }) as unknown as IncomingMessage;

test("client address trusts proxy headers only from the configured network", () => {
  const cf = { "cf-connecting-ip": "203.0.113.9" };
  assert.equal(clientOf(request("127.0.0.1", cf)), "203.0.113.9");
  assert.equal(clientOf(request("172.18.0.3", cf)), "172.18.0.3");
  assert.equal(clientOf(request("172.18.0.3", cf), "private"), "203.0.113.9");
  assert.equal(clientOf(request("198.51.100.1", cf), "private"), "198.51.100.1");
  assert.equal(clientOf(request("127.0.0.1", cf), "none"), "127.0.0.1");
  assert.equal(clientOf(request("::1", { "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
  assert.ok(isPrivate("::ffff:192.168.1.4") && isPrivate("fd12:3456::1") && !isPrivate("8.8.8.8") && !isPrivate("172.32.0.1"));
});

test("service config reads the environment with safe defaults", () => {
  const defaults = loadServiceConfig({});
  assert.equal(defaults.dbFile, undefined);
  assert.equal(defaults.cycleIntervalMs, 60_000);
  assert.deepEqual(defaults.corsOrigins, []);
  assert.equal(defaults.trustProxy, "loopback");

  const custom = loadServiceConfig({ DATA_FILE: "./data/snapshot.json", CORS_ORIGINS: "https://a.test, https://b.test", CYCLE_TIMEOUT_SECONDS: "abc", TRUST_PROXY: "private", LOG_LEVEL: "warn" });
  assert.equal(custom.dataDir, "./data");
  assert.equal(custom.dbFile, "data/news.db");
  assert.equal(custom.xSnapshotFile, "./data/snapshot.json");
  assert.deepEqual(custom.corsOrigins, ["https://a.test", "https://b.test"]);
  assert.equal(custom.cycleTimeoutMs, 300_000);
  assert.equal(custom.trustProxy, "private");
  assert.equal(custom.logLevel, "warn");
});
