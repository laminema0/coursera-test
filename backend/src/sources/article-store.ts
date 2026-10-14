import type { Article } from "./types.ts";

export interface SourceState {
  etag?: string;
  lastModified?: string;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  consecutiveFailures: number;
  nextFetchAt?: string;
  lastError?: string;
}

export interface ArticleSnapshot {
  articles: Article[];
  sourceState: Record<string, SourceState>;
}

export class ArticleStore {
  readonly articles = new Map<string, Article>();
  readonly sourceState = new Map<string, SourceState>();

  state(sourceId: string): SourceState {
    let state = this.sourceState.get(sourceId);
    if (!state) {
      state = { consecutiveFailures: 0 };
      this.sourceState.set(sourceId, state);
    }
    return state;
  }

  /** Newest first. */
  recent(options: { since?: Date; limit: number }): Article[] {
    const since = options.since?.toISOString();
    return [...this.articles.values()]
      .filter((a) => !since || a.fetchedAt > since)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, options.limit);
  }

  removeOlderThan(cutoff: Date): number {
    const iso = cutoff.toISOString();
    let removed = 0;
    for (const [id, article] of this.articles) {
      if (article.fetchedAt < iso) {
        this.articles.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  snapshot(): ArticleSnapshot {
    return { articles: [...this.articles.values()], sourceState: Object.fromEntries(this.sourceState) };
  }

  static restore(snapshot: ArticleSnapshot): ArticleStore {
    const store = new ArticleStore();
    for (const a of snapshot.articles) store.articles.set(a.id, a);
    for (const [id, s] of Object.entries(snapshot.sourceState)) store.sourceState.set(id, s);
    return store;
  }
}
