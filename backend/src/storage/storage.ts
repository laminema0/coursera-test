import type { HistorySnapshot } from "../analysis/history.ts";
import type { TrackRecordSnapshot } from "../analysis/track-record.ts";
import type { ArticleSnapshot } from "../sources/article-store.ts";
import type { Snapshot as XSnapshot } from "../store.ts";

/** Everything the service keeps between restarts. Each part is optional on commit: parts left out are not touched. */
export interface PersistedState {
  articles: ArticleSnapshot;
  trackRecord: TrackRecordSnapshot;
  history: HistorySnapshot;
  /** Only when the optional X integration has run at least once. */
  x?: XSnapshot;
}

export interface CommitStats {
  upserted: number;
  deleted: number;
}

/**
 * Durable state. The working set stays in memory (analysis needs every article anyway);
 * storage receives a full snapshot once per cycle and writes only what changed, in one transaction.
 */
export interface Storage {
  readonly kind: "sqlite" | "memory";
  load(): PersistedState;
  /** Atomic: either every part is written or none is. */
  commit(state: Partial<PersistedState>): CommitStats;
  /** Deletes articles fetched before the cutoff (safety net for retention). Returns rows removed. */
  cleanup(options: { articlesFetchedBefore: Date }): number;
  getMeta(key: string): string | undefined;
  setMeta(key: string, value: string): void;
  close(): void;
}

export const emptyState = (): PersistedState => ({
  articles: { articles: [], sourceState: {} },
  trackRecord: { sources: {}, evaluatedEventIds: [] },
  history: {},
});

/** Keeps the last committed state in memory. For tests and for running without a data directory. */
export class MemoryStorage implements Storage {
  readonly kind = "memory";
  #state: PersistedState = emptyState();
  readonly #meta = new Map<string, string>();
  commits = 0;

  load(): PersistedState {
    return structuredClone(this.#state);
  }

  commit(state: Partial<PersistedState>): CommitStats {
    const next = { ...this.#state };
    for (const [key, value] of Object.entries(state)) {
      if (value !== undefined) (next as Record<string, unknown>)[key] = structuredClone(value);
    }
    this.#state = next;
    this.commits += 1;
    return { upserted: 0, deleted: 0 };
  }

  cleanup(options: { articlesFetchedBefore: Date }): number {
    const cutoff = options.articlesFetchedBefore.toISOString();
    const before = this.#state.articles.articles.length;
    this.#state.articles.articles = this.#state.articles.articles.filter((a) => a.fetchedAt >= cutoff);
    return before - this.#state.articles.articles.length;
  }

  getMeta(key: string): string | undefined {
    return this.#meta.get(key);
  }

  setMeta(key: string, value: string): void {
    this.#meta.set(key, value);
  }

  close(): void {}
}
