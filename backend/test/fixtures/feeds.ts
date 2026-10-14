import type { NewsSource, SourceList } from "../../src/sources/types.ts";
import { articles, sources } from "./breaking.ts";

// The breaking-news fixture rendered as RSS feeds, one per source, for end-to-end tests.

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function rssFor(sourceId: string): string {
  const items = articles.filter((a) => a.sourceIds.includes(sourceId)).map((a) => `
    <item>
      <title>${escape(a.title)}</title>
      <link>${escape(a.url)}</link>
      ${a.summary ? `<description>${escape(a.summary)}</description>` : ""}
      <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>
    </item>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${sourceId}</title>${items}</channel></rss>`;
}

/** Fixture sources pointing at `${baseUrl}/feeds/<id>.xml`, all served as RSS. */
export function fixtureSourceList(baseUrl: string): SourceList {
  return {
    language: "en",
    sources: sources.map((s): NewsSource => ({ ...s, format: "rss", url: `${baseUrl}/feeds/${s.id}.xml` })),
  };
}

/** In-process fetch that serves the fixture feeds; `overrides` replace individual responses. */
export function fixtureFetch(overrides: Record<string, () => Response | Promise<Response>> = {}): typeof fetch & { calls: string[] } {
  const calls: string[] = [];
  const fn = async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push(url.pathname);
    const override = overrides[url.pathname];
    if (override) return override();
    const m = url.pathname.match(/^\/feeds\/(.+)\.xml$/);
    if (m && sources.some((s) => s.id === m[1])) return new Response(rssFor(m[1]!), { status: 200, headers: { "Content-Type": "application/rss+xml" } });
    return new Response("not found", { status: 404 });
  };
  return Object.assign(fn as typeof fetch, { calls });
}
