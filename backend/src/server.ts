import { createServer, type Server } from "node:http";
import { buildFeed } from "./feed.ts";
import type { MemoryStore } from "./store.ts";

/** Read-only HTTP API for the app. The app never talks to X directly. */
export function createApiServer(store: MemoryStore, now: () => Date = () => new Date()): Server {
  return createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
      response.end(JSON.stringify(body));
    };

    if (request.method !== "GET") return send(405, { error: "method_not_allowed" });

    if (url.pathname === "/health") {
      return send(200, { ok: true, posts: store.posts.size, stories: store.stories.size });
    }

    if (url.pathname === "/v1/feed") {
      const sinceParam = url.searchParams.get("since");
      const since = sinceParam ? new Date(sinceParam) : undefined;
      if (since && Number.isNaN(since.getTime())) return send(400, { error: "invalid_since" });
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
      return send(200, buildFeed(store, { since, limit, now: now() }), { "Cache-Control": "public, max-age=30" });
    }

    send(404, { error: "not_found" });
  });
}
