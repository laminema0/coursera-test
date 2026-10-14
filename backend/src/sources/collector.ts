import { canonicalizeUrl, storyIdFor } from "../news/url.ts";
import type { ArticleStore } from "./article-store.ts";
import { parseFeed, parseUsgsGeoJson } from "./parse.ts";
import type { FeedEntry, NewsSource } from "./types.ts";

export interface CollectorReport {
  attempted: number;
  notModified: number;
  failed: { sourceId: string; error: string }[];
  newArticles: number;
  expired: number;
}

export interface CollectorDeps {
  sources: NewsSource[];
  language: string;
  store: ArticleStore;
  fetch?: typeof fetch;
  now?: () => Date;
  /** Articles older than this are dropped (by fetch time). */
  retentionHours?: number;
  concurrency?: number;
  timeoutMs?: number;
}

const MAX_BACKOFF_MINUTES = 6 * 60;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const USER_AGENT = "NewsVerify/0.1 (independent non-commercial project; RSS reader)";

/**
 * Polls free sources (RSS/Atom/RDF feeds, USGS GeoJSON) politely:
 * conditional GET (ETag / Last-Modified), per-source interval, exponential backoff on errors.
 */
type ResolvedDeps = Required<CollectorDeps>;

export class Collector {
  readonly #d: ResolvedDeps;

  constructor(deps: CollectorDeps) {
    this.#d = {
      ...deps,
      retentionHours: deps.retentionHours ?? 72,
      concurrency: deps.concurrency ?? 8,
      timeoutMs: deps.timeoutMs ?? 15_000,
      fetch: deps.fetch ?? fetch,
      now: deps.now ?? (() => new Date()),
    };
  }

  async runCycle(): Promise<CollectorReport> {
    const now = this.#d.now();
    const report: CollectorReport = { attempted: 0, notModified: 0, failed: [], newArticles: 0, expired: 0 };
    const due = this.#d.sources.filter((source) => {
      const next = this.#d.store.state(source.id).nextFetchAt;
      return !next || Date.parse(next) <= now.getTime();
    });

    const queue = [...due];
    const workers = Array.from({ length: Math.min(this.#d.concurrency, queue.length) }, async () => {
      for (let source = queue.shift(); source; source = queue.shift()) {
        await this.#fetchSource(source, now, report);
      }
    });
    await Promise.all(workers);

    report.expired = this.#d.store.removeOlderThan(new Date(now.getTime() - this.#d.retentionHours * 3_600_000));
    return report;
  }

  async #fetchSource(source: NewsSource, now: Date, report: CollectorReport): Promise<void> {
    const state = this.#d.store.state(source.id);
    state.lastAttemptAt = now.toISOString();
    report.attempted += 1;

    try {
      const headers: Record<string, string> = { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml, application/json;q=0.9, */*;q=0.5" };
      if (state.etag) headers["If-None-Match"] = state.etag;
      if (state.lastModified) headers["If-Modified-Since"] = state.lastModified;

      const response = await this.#d.fetch(source.url, { headers, redirect: "follow", signal: AbortSignal.timeout(this.#d.timeoutMs) });
      if (response.status === 304) {
        report.notModified += 1;
      } else if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      } else {
        const body = await response.text();
        if (body.length > MAX_BODY_BYTES) throw new Error("Feed too large");
        const entries = source.format === "usgs-geojson" ? parseUsgsGeoJson(body) : parseFeed(body);
        if (entries.length === 0) throw new Error("No entries found (format changed or not a feed)");
        report.newArticles += this.#storeEntries(source, entries, now);
        state.etag = response.headers.get("etag") ?? undefined;
        state.lastModified = response.headers.get("last-modified") ?? undefined;
      }
      state.consecutiveFailures = 0;
      state.lastError = undefined;
      state.lastSuccessAt = now.toISOString();
      state.nextFetchAt = new Date(now.getTime() + source.pollMinutes * 60_000).toISOString();
    } catch (error) {
      state.consecutiveFailures += 1;
      state.lastError = error instanceof Error ? error.message : String(error);
      const backoff = Math.min(MAX_BACKOFF_MINUTES, source.pollMinutes * 2 ** state.consecutiveFailures);
      state.nextFetchAt = new Date(now.getTime() + backoff * 60_000).toISOString();
      report.failed.push({ sourceId: source.id, error: state.lastError });
    }
  }

  #storeEntries(source: NewsSource, entries: FeedEntry[], now: Date): number {
    let added = 0;
    const oldest = new Date(now.getTime() - this.#d.retentionHours * 3_600_000).toISOString();
    for (const entry of entries) {
      // Some feeds list items that are weeks old; they are not news anymore.
      if (entry.publishedAt && entry.publishedAt < oldest) continue;
      const url = canonicalizeUrl(entry.url);
      if (!url) continue;
      const id = storyIdFor(url);
      const existing = this.#d.store.articles.get(id);
      if (existing) {
        if (!existing.sourceIds.includes(source.id)) existing.sourceIds.push(source.id);
        continue;
      }
      // Feeds without dates (or with future dates) get the time we first saw the item.
      const published = entry.publishedAt && entry.publishedAt <= now.toISOString() ? entry.publishedAt : now.toISOString();
      this.#d.store.articles.set(id, {
        id,
        url,
        title: entry.title,
        summary: entry.summary,
        publishedAt: published,
        fetchedAt: now.toISOString(),
        language: this.#d.language,
        sourceIds: [source.id],
      });
      added += 1;
    }
    return added;
  }
}
