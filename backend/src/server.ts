import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { gzipSync } from "node:zlib";
import type { TrackRecord } from "./analysis/track-record.ts";
import type { EventsResponse } from "./events-api.ts";
import { buildFeed } from "./feed.ts";
import { type Logger, silentLogger } from "./log.ts";
import type { Metrics } from "./metrics.ts";
import type { ArticleStore } from "./sources/article-store.ts";
import type { NewsSource } from "./sources/types.ts";
import { clientOf, isPrivate, RateLimiter } from "./rate-limit.ts";
import type { TrustProxy } from "./service-config.ts";
import type { MemoryStore } from "./store.ts";

export interface ApiDeps {
  articles: ArticleStore;
  sources: NewsSource[];
  /** Latest analysis result, recomputed after each collection cycle. */
  events?: () => EventsResponse | undefined;
  /** Learned accuracy of each source on settled events. */
  trackRecord?: TrackRecord;
  /** Present only when the optional (paid) X integration is enabled. */
  xStore?: MemoryStore;
  now?: () => Date;
  rateLimiter?: RateLimiter;
  metrics?: Metrics;
  log?: Logger;
  /** Allowed browser origins; empty or unset = no CORS headers at all. */
  corsOrigins?: string[];
  trustProxy?: TrustProxy;
  /** Lets /metrics be scraped from outside the private network with `Authorization: Bearer <token>`. */
  metricsToken?: string;
}

/** Bodies smaller than this aren't worth compressing. */
const GZIP_MIN_BYTES = 1024;
const UNLIMITED = new Set(["/health", "/ready", "/metrics"]);
const ROUTES = new Set(["/health", "/ready", "/metrics", "/v1/articles", "/v1/events", "/v1/sources", "/v1/feed"]);

interface Prepared {
  body: Buffer;
  etag: string;
  gzipped?: Buffer;
}

/** Read-only HTTP API for the app. The app never talks to news sources or X directly. */
export function createApiServer(deps: ApiDeps): Server {
  const now = deps.now ?? (() => new Date());
  const sourcesById = new Map(deps.sources.map((s) => [s.id, s]));
  const limiter = deps.rateLimiter ?? new RateLimiter();
  const log = deps.log ?? silentLogger;
  const cors = deps.corsOrigins ?? [];
  const trust = deps.trustProxy ?? "loopback";
  const started = Date.now();
  // Serialized /v1/events responses per analysis result and query, so ETag and gzip are computed once per cycle.
  const eventsCache = new WeakMap<EventsResponse, Map<string, Prepared>>();

  const server = createServer((request, response) => {
    const startedAt = process.hrtime.bigint();
    const url = new URL(request.url ?? "/", "http://localhost");
    const route = ROUTES.has(url.pathname) ? url.pathname : "other";
    const client = clientOf(request, trust);

    response.on("finish", () => {
      const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      deps.metrics?.httpRequests.inc({ route, method: request.method ?? "", status: String(response.statusCode) });
      deps.metrics?.httpDuration.observe(seconds, { route });
      const fields = {
        method: request.method, path: url.pathname, query: url.search || undefined, status: response.statusCode,
        ms: Math.round(seconds * 1e4) / 10, bytes: Number(response.getHeader("Content-Length") ?? 0), client,
      };
      if (UNLIMITED.has(url.pathname)) log.debug("http", fields);
      else log.info("http", fields);
    });

    try {
      handle(request, response, url, client);
    } catch (error) {
      log.error("http handler failed", { path: url.pathname, error });
      if (!response.headersSent) sendJson(request, response, 500, { error: "internal" });
      else response.destroy();
    }
  });

  // Behind Cloudflare Tunnel, connections are reused; keep them a bit longer than its idle timeout.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 30_000;
  server.on("clientError", (error, socket) => {
    log.debug("http client error", { error: error.message });
    if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  });
  return server;

  function handle(request: IncomingMessage, response: ServerResponse, url: URL, client: string): void {
    applyCors(request, response);
    response.setHeader("X-Content-Type-Options", "nosniff");

    if (request.method === "OPTIONS" && cors.length > 0) {
      response.writeHead(204, { "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS", "Access-Control-Allow-Headers": "If-None-Match, Content-Type", "Access-Control-Max-Age": "600" });
      response.end();
      return;
    }
    const send = (status: number, body: unknown, headers: Record<string, string> = {}) => sendJson(request, response, status, body, headers);
    if (request.method !== "GET" && request.method !== "HEAD") return send(405, { error: "method_not_allowed" }, { Allow: "GET, HEAD" });

    const retryAfter = UNLIMITED.has(url.pathname) ? undefined : limiter.check(client);
    if (retryAfter !== undefined) {
      deps.metrics?.httpRateLimited.inc();
      return send(429, { error: "rate_limited" }, { "Retry-After": String(retryAfter) });
    }

    const sinceParam = url.searchParams.get("since");
    const since = sinceParam ? new Date(sinceParam) : undefined;
    if (since && Number.isNaN(since.getTime())) return send(400, { error: "invalid_since" });
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 100));

    switch (url.pathname) {
      case "/health":
        return send(200, { ok: true, articles: deps.articles.articles.size, x_enabled: Boolean(deps.xStore), uptime_seconds: Math.round((Date.now() - started) / 1000) }, { "Cache-Control": "no-store" });

      case "/ready": {
        const result = deps.events?.();
        if (!result) return send(503, { ready: false }, { "Cache-Control": "no-store", "Retry-After": "30" });
        return send(200, { ready: true, generated_at: result.generated_at, events: result.events.length }, { "Cache-Control": "no-store" });
      }

      case "/metrics": {
        if (!deps.metrics || !metricsAllowed(request)) return send(404, { error: "not_found" });
        const body = Buffer.from(deps.metrics.registry.render());
        return sendPrepared(request, response, 200, { body, etag: "" }, { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store" });
      }

      case "/v1/articles":
        return send(200, {
          generated_at: now().toISOString(),
          articles: deps.articles.recent({ since, limit }).map((a) => ({
            id: a.id,
            url: a.url,
            title: a.title,
            summary: a.summary,
            published_at: a.publishedAt,
            fetched_at: a.fetchedAt,
            language: a.language,
            sources: a.sourceIds.flatMap((id) => {
              const s = sourcesById.get(id);
              return s ? [{ id: s.id, name: s.name, tier: String(s.tier), owner: s.owner, country: s.country }] : [];
            }),
          })),
        }, { "Cache-Control": "public, max-age=30" });

      case "/v1/events": {
        const result = deps.events?.();
        if (!result) return send(503, { error: "not_ready" }, { "Retry-After": "30" });
        let byQuery = eventsCache.get(result);
        if (!byQuery) eventsCache.set(result, (byQuery = new Map()));
        const key = url.searchParams.toString();
        let prepared = byQuery.get(key);
        if (!prepared) {
          const status = url.searchParams.get("status");
          const sort = url.searchParams.get("sort") ?? "importance";
          const breakingOnly = url.searchParams.get("breaking") === "true";
          const events = result.events
            .filter((e) => !status || e.verification.status === status)
            .filter((e) => !breakingOnly || e.breaking)
            .filter((e) => !since || e.last_updated_at > since.toISOString())
            .sort((a, b) => (sort === "recent" ? b.last_updated_at.localeCompare(a.last_updated_at) : b.importance - a.importance))
            .slice(0, limit);
          prepared = prepare({ ...result, events });
          if (byQuery.size >= 64) byQuery.clear();
          byQuery.set(key, prepared);
        }
        return sendPrepared(request, response, 200, prepared, { "Cache-Control": "public, max-age=30" });
      }

      case "/v1/sources":
        return send(200, {
          sources: deps.sources.map((s) => {
            const state = deps.articles.sourceState.get(s.id);
            const r = deps.trackRecord?.sources.get(s.id);
            return {
              id: s.id, name: s.name, tier: String(s.tier), owner: s.owner, country: s.country,
              state_funded: s.stateFunded ?? false,
              healthy: (state?.consecutiveFailures ?? 0) === 0,
              last_success_at: state?.lastSuccessAt,
              track_record: r && {
                events_settled: r.eventsSettled,
                numbers_checked: r.numbersChecked,
                numbers_close: r.numbersClose,
                numbers_high: r.numbersHigh,
                numbers_low: r.numbersLow,
                disputed_or_retracted: r.disputedOrRetracted,
              },
            };
          }),
        });

      case "/v1/feed":
        if (!deps.xStore) return send(404, { error: "x_disabled" });
        return send(200, buildFeed(deps.xStore, { since, limit, now: now() }), { "Cache-Control": "public, max-age=30" });

      default:
        return send(404, { error: "not_found" });
    }
  }

  function applyCors(request: IncomingMessage, response: ServerResponse): void {
    if (cors.length === 0) return;
    response.setHeader("Vary", "Origin, Accept-Encoding");
    const origin = request.headers.origin;
    if (!origin) return;
    if (cors.includes("*")) response.setHeader("Access-Control-Allow-Origin", "*");
    else if (cors.includes(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
    else return;
    response.setHeader("Access-Control-Expose-Headers", "ETag, Retry-After");
  }

  /** Scrapers on the host or private network may read metrics; through the tunnel only with the token. */
  function metricsAllowed(request: IncomingMessage): boolean {
    const auth = request.headers.authorization;
    if (deps.metricsToken && auth) {
      const given = Buffer.from(auth.replace(/^Bearer\s+/i, ""));
      const expected = Buffer.from(deps.metricsToken);
      if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
    }
    const viaProxy = request.headers["cf-connecting-ip"] !== undefined || request.headers["x-forwarded-for"] !== undefined;
    return !viaProxy && isPrivate(request.socket.remoteAddress ?? "");
  }
}

function prepare(value: unknown): Prepared {
  const body = Buffer.from(JSON.stringify(value));
  return { body, etag: `W/"${createHash("sha1").update(body).digest("base64url")}"` };
}

function sendJson(request: IncomingMessage, response: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
  sendPrepared(request, response, status, status === 200 ? prepare(value) : { body: Buffer.from(JSON.stringify(value)), etag: "" }, headers);
}

/** Writes a body with ETag / If-None-Match handling and gzip when the client accepts it. */
function sendPrepared(request: IncomingMessage, response: ServerResponse, status: number, prepared: Prepared, headers: Record<string, string>): void {
  const out: Record<string, string> = { "Content-Type": "application/json; charset=utf-8", ...headers };
  if (prepared.etag) {
    out.ETag = prepared.etag;
    if (matchesEtag(request.headers["if-none-match"], prepared.etag)) {
      delete out["Content-Type"];
      response.writeHead(304, out);
      response.end();
      return;
    }
  }

  let body = prepared.body;
  const varies = response.getHeader("Vary");
  if (!varies) out.Vary = "Accept-Encoding";
  if (body.length >= GZIP_MIN_BYTES && acceptsGzip(request.headers["accept-encoding"])) {
    prepared.gzipped ??= gzipSync(body, { level: 6 });
    body = prepared.gzipped;
    out["Content-Encoding"] = "gzip";
  }
  out["Content-Length"] = String(body.length);
  response.writeHead(status, out);
  response.end(request.method === "HEAD" ? undefined : body);
}

/** Weak comparison (RFC 9110 §13.1.2): `W/"x"` matches `"x"`. */
export function matchesEtag(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  const strip = (tag: string) => tag.trim().replace(/^W\//, "");
  const target = strip(etag);
  return header.split(",").some((tag) => tag.trim() === "*" || strip(tag) === target);
}

export function acceptsGzip(header: string | string[] | undefined): boolean {
  const value = Array.isArray(header) ? header.join(",") : header ?? "";
  return value.split(",").some((part) => {
    const [coding, ...params] = part.trim().toLowerCase().split(";");
    if (coding !== "gzip" && coding !== "*") return false;
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    return !q || Number(q.slice(2)) > 0;
  });
}
