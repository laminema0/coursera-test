import type { DailyBudget } from "./budget.ts";
import type { Config, SourceGroup } from "./config.ts";
import { fetchPageMetadata, type PageMetadata } from "./news/opengraph.ts";
import { articleLinkOf, canonicalizeUrl, publisherOf, storyIdFor } from "./news/url.ts";
import type { MemoryStore, StoredPost } from "./store.ts";
import { type XClient, XRateLimitError } from "./x/client.ts";
import { buildQueries } from "./x/query.ts";
import type { XPost } from "./x/types.ts";

export interface CycleReport {
  compliance: { checked: number; deleted: number; expired: number; unverifiable: number };
  polledGroups: string[];
  newPosts: number;
  skippedForBudget: string[];
  profilesRefreshed: number;
  storiesEnriched: number;
  rateLimitedUntil?: string;
  spentTodayUsd: number;
}

export interface IngestorDeps {
  config: Config;
  client: XClient;
  store: MemoryStore;
  budget: DailyBudget;
  now?: () => Date;
  fetchMetadata?: (url: string) => Promise<PageMetadata>;
  log?: (message: string) => void;
}

const MIN_SEARCH_RESULTS = 10;
const ENRICH_PER_CYCLE = 10;

/**
 * One ingestion cycle, in priority order:
 * 1. Compliance first (policy obligation; never skipped for budget: unverifiable posts are removed instead).
 * 2. Poll due source groups for new posts (within the daily budget).
 * 3. Refresh author profiles needed for display.
 * 4. Enrich stories with headline/summary/image from the publisher page (free, not X).
 */
export class Ingestor {
  readonly #c: Config;
  readonly #x: XClient;
  readonly #store: MemoryStore;
  readonly #budget: DailyBudget;
  readonly #now: () => Date;
  readonly #fetchMetadata: (url: string) => Promise<PageMetadata>;
  readonly #log: (message: string) => void;

  constructor(deps: IngestorDeps) {
    this.#c = deps.config;
    this.#x = deps.client;
    this.#store = deps.store;
    this.#budget = deps.budget;
    this.#now = deps.now ?? (() => new Date());
    this.#fetchMetadata = deps.fetchMetadata ?? ((url) => fetchPageMetadata(url));
    this.#log = deps.log ?? (() => {});
  }

  async runCycle(): Promise<CycleReport> {
    const report: CycleReport = {
      compliance: { checked: 0, deleted: 0, expired: 0, unverifiable: 0 },
      polledGroups: [],
      newPosts: 0,
      skippedForBudget: [],
      profilesRefreshed: 0,
      storiesEnriched: 0,
      spentTodayUsd: 0,
    };

    try {
      this.#expireOldPosts(report);
      if (!this.#isPaused()) {
        await this.#checkCompliance(report);
        for (const group of this.#dueGroups()) {
          await this.#pollGroup(group, report);
        }
        await this.#refreshProfiles(report);
      }
    } catch (error) {
      if (!(error instanceof XRateLimitError)) throw error;
      this.#store.pausedUntil = error.resetAt;
      report.rateLimitedUntil = error.resetAt.toISOString();
      this.#log(`Rate limited by X until ${report.rateLimitedUntil}`);
    } finally {
      // Runs even when X is unavailable: page metadata comes from publishers.
      await this.#enrichStories(report);
      this.#store.pruneTombstones(new Date(this.#now().getTime() - 7 * 24 * 3_600_000));
      this.#store.budgetState = this.#budget.state();
      report.spentTodayUsd = Number(this.#budget.spentUsd.toFixed(4));
    }
    return report;
  }

  #isPaused(): boolean {
    const until = this.#store.pausedUntil;
    if (until && until > this.#now()) return true;
    this.#store.pausedUntil = undefined;
    return false;
  }

  #expireOldPosts(report: CycleReport): void {
    const cutoff = this.#now().getTime() - this.#c.retentionHours * 3_600_000;
    const expired = [...this.#store.posts.values()].filter((p) => Date.parse(p.fetchedAt) < cutoff).map((p) => p.id);
    report.compliance.expired = this.#store.removePosts(expired, "expired", this.#now());
  }

  async #checkCompliance(report: CycleReport): Promise<void> {
    const now = this.#now();
    const cutoff = now.getTime() - this.#c.complianceCheckMinutes * 60_000;
    const due = [...this.#store.posts.values()].filter((p) => Date.parse(p.verifiedAt) <= cutoff).map((p) => p.id);

    for (let i = 0; i < due.length; i += 100) {
      const batch = due.slice(i, i + 100);
      // Worst case every id is billable. If we can't pay, we can't prove the posts still exist,
      // so we remove them: removing content is always compliant.
      if (this.#budget.costOf("post", batch) > this.#budget.remainingUsd) {
        report.compliance.unverifiable += this.#store.removePosts(batch, "unverifiable", now);
        continue;
      }
      const response = await this.#x.lookupPosts(batch);
      const alive = new Map((response.data ?? []).map((p) => [p.id, p]));
      this.#budget.record("post", [...alive.keys()]);
      report.compliance.checked += batch.length;

      const gone = batch.filter((id) => !alive.has(id));
      report.compliance.deleted += this.#store.removePosts(gone, "deleted", now);
      for (const [id, fresh] of alive) {
        const stored = this.#store.posts.get(id);
        if (!stored) continue;
        stored.verifiedAt = now.toISOString();
        stored.text = fresh.text;
        stored.metrics = metricsOf(fresh) ?? stored.metrics;
      }
    }
  }

  #dueGroups(): SourceGroup[] {
    const now = this.#now().getTime();
    return this.#c.groups.filter((group) => {
      const last = this.#store.lastPolledAt.get(group.id);
      return !last || now - Date.parse(last) >= group.pollMinutes * 60_000;
    });
  }

  async #pollGroup(group: SourceGroup, report: CycleReport): Promise<void> {
    const now = this.#now();
    for (const query of buildQueries(group.accounts, this.#c.maxQueryLength)) {
      const sinceId = this.#store.cursors.get(query);
      let nextToken: string | undefined;

      for (let page = 0; page < this.#c.maxPagesPerPoll; page += 1) {
        const maxResults = Math.min(100, group.maxResultsPerPoll, this.#budget.affordable("post"));
        if (maxResults < MIN_SEARCH_RESULTS) {
          if (!report.skippedForBudget.includes(group.id)) report.skippedForBudget.push(group.id);
          break;
        }
        const response = await this.#x.searchRecent({
          query,
          maxResults,
          sinceId,
          startTime: sinceId ? undefined : new Date(now.getTime() - this.#c.firstRunLookbackMinutes * 60_000),
          nextToken,
        });
        const posts = response.data ?? [];
        this.#budget.record("post", posts.map((p) => p.id));
        report.newPosts += this.#storePosts(posts, now);

        // newest_id of the first page is the newest overall; later pages go back in time.
        if (page === 0 && response.meta.newest_id) this.#store.cursors.set(query, response.meta.newest_id);
        nextToken = response.meta.next_token;
        if (!nextToken) break;
      }
    }
    this.#store.lastPolledAt.set(group.id, now.toISOString());
    report.polledGroups.push(group.id);
  }

  #storePosts(posts: XPost[], now: Date): number {
    let added = 0;
    for (const post of posts) {
      const link = articleLinkOf(post);
      if (!link || !post.author_id || this.#store.posts.has(post.id)) continue;

      const storyId = storyIdFor(link.url);
      const createdAt = post.created_at ?? now.toISOString();
      const story = this.#store.stories.get(storyId);
      if (story) {
        story.title ??= link.title;
        story.description ??= link.description;
        story.imageUrl ??= link.imageUrl;
        if (createdAt > story.lastActivityAt) story.lastActivityAt = createdAt;
      } else {
        this.#store.stories.set(storyId, {
          id: storyId,
          url: link.url,
          publisher: publisherOf(link.url),
          title: link.title,
          description: link.description,
          imageUrl: link.imageUrl,
          firstSeenAt: now.toISOString(),
          lastActivityAt: createdAt,
        });
      }

      const stored: StoredPost = {
        id: post.id,
        text: post.text,
        authorId: post.author_id,
        createdAt,
        lang: post.lang,
        possiblySensitive: post.possibly_sensitive ?? false,
        storyId,
        metrics: metricsOf(post),
        fetchedAt: now.toISOString(),
        verifiedAt: now.toISOString(),
      };
      this.#store.posts.set(post.id, stored);
      added += 1;
    }
    return added;
  }

  async #refreshProfiles(report: CycleReport): Promise<void> {
    const staleBefore = this.#now().getTime() - this.#c.profileRefreshHours * 3_600_000;
    const needed = [...new Set([...this.#store.posts.values()].map((p) => p.authorId))].filter((id) => {
      const user = this.#store.users.get(id);
      return !user || Date.parse(user.refreshedAt) < staleBefore;
    });

    for (let i = 0; i < needed.length; i += 100) {
      const batch = needed.slice(i, i + 100).slice(0, this.#budget.affordable("user"));
      if (batch.length === 0) break;
      const response = await this.#x.lookupUsers(batch);
      const users = response.data ?? [];
      this.#budget.record("user", users.map((u) => u.id));
      for (const user of users) {
        this.#store.users.set(user.id, {
          id: user.id,
          username: user.username,
          name: user.name,
          profileImageUrl: user.profile_image_url,
          verified: user.verified ?? false,
          verifiedType: user.verified_type,
          refreshedAt: this.#now().toISOString(),
        });
      }
      report.profilesRefreshed += users.length;
    }
  }

  async #enrichStories(report: CycleReport): Promise<void> {
    const pending = [...this.#store.stories.values()].filter((s) => !s.enrichedAt).slice(0, ENRICH_PER_CYCLE);
    await Promise.all(
      pending.map(async (story) => {
        try {
          const meta = await this.#fetchMetadata(story.url);
          story.title ??= meta.title;
          story.description ??= meta.description;
          story.imageUrl ??= meta.imageUrl;
          const canonical = meta.canonicalUrl ? canonicalizeUrl(meta.canonicalUrl) : null;
          if (canonical && publisherOf(canonical) === story.publisher) story.url = canonical;
          report.storiesEnriched += 1;
        } catch (error) {
          this.#log(`Metadata fetch failed for ${story.url}: ${String(error)}`);
        } finally {
          story.enrichedAt = this.#now().toISOString();
        }
      }),
    );
  }
}

function metricsOf(post: XPost): StoredPost["metrics"] {
  const m = post.public_metrics;
  return m ? { likes: m.like_count, reposts: m.retweet_count, replies: m.reply_count, quotes: m.quote_count } : undefined;
}
