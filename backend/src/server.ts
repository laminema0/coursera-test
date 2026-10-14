import { createServer, type Server } from "node:http";
import { buildFeed } from "./feed.ts";
import type { ArticleStore } from "./sources/article-store.ts";
import type { NewsSource } from "./sources/types.ts";
import type { MemoryStore } from "./store.ts";

export interface ApiDeps {
  articles: ArticleStore;
  sources: NewsSource[];
  /** Present only when the optional (paid) X integration is enabled. */
  xStore?: MemoryStore;
  now?: () => Date;
}

/** Read-only HTTP API for the app. The app never talks to news sources or X directly. */
export function createApiServer(deps: ApiDeps): Server {
  const now = deps.now ?? (() => new Date());
  const sourcesById = new Map(deps.sources.map((s) => [s.id, s]));

  return createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
      response.end(JSON.stringify(body));
    };

    if (request.method !== "GET") return send(405, { error: "method_not_allowed" });

    const sinceParam = url.searchParams.get("since");
    const since = sinceParam ? new Date(sinceParam) : undefined;
    if (since && Number.isNaN(since.getTime())) return send(400, { error: "invalid_since" });
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 100));

    switch (url.pathname) {
      case "/health":
        return send(200, { ok: true, articles: deps.articles.articles.size, x_enabled: Boolean(deps.xStore) });

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

      case "/v1/sources":
        return send(200, {
          sources: deps.sources.map((s) => {
            const state = deps.articles.sourceState.get(s.id);
            return { id: s.id, name: s.name, tier: String(s.tier), owner: s.owner, country: s.country, state_funded: s.stateFunded ?? false, healthy: (state?.consecutiveFailures ?? 0) === 0, last_success_at: state?.lastSuccessAt };
          }),
        });

      case "/v1/feed":
        if (!deps.xStore) return send(404, { error: "x_disabled" });
        return send(200, buildFeed(deps.xStore, { since, limit, now: now() }), { "Cache-Control": "public, max-age=30" });

      default:
        return send(404, { error: "not_found" });
    }
  });
}
