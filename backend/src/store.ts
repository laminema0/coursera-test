import type { BudgetState } from "./budget.ts";

export interface StoredPost {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
  lang?: string;
  possiblySensitive: boolean;
  storyId: string;
  metrics?: { likes: number; reposts: number; replies: number; quotes: number };
  /** When we first fetched it. Retention is measured from here. */
  fetchedAt: string;
  /** Last time we confirmed via the API that the post still exists. */
  verifiedAt: string;
}

export interface StoredUser {
  id: string;
  username: string;
  name: string;
  profileImageUrl?: string;
  verified: boolean;
  verifiedType?: string;
  refreshedAt: string;
}

export interface Story {
  id: string;
  url: string;
  publisher: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  firstSeenAt: string;
  lastActivityAt: string;
  /** Set once we tried fetching page metadata, successful or not. */
  enrichedAt?: string;
}

export interface Tombstone {
  postId: string;
  removedAt: string;
  reason: "deleted" | "expired" | "unverifiable";
}

export interface Snapshot {
  posts: StoredPost[];
  users: StoredUser[];
  stories: Story[];
  cursors: Record<string, string>;
  lastPolledAt: Record<string, string>;
  pausedUntil?: string;
  tombstones: Tombstone[];
  budget?: BudgetState;
}

/** In-memory store with JSON snapshots. Swap for SQLite/Postgres when running more than one instance. */
export class MemoryStore {
  readonly posts = new Map<string, StoredPost>();
  readonly users = new Map<string, StoredUser>();
  readonly stories = new Map<string, Story>();
  /** search query → newest post id seen (used as since_id). */
  readonly cursors = new Map<string, string>();
  /** group id → ISO time of last poll. */
  readonly lastPolledAt = new Map<string, string>();
  /** Set after a 429: no X calls until this time. */
  pausedUntil?: Date;
  tombstones: Tombstone[] = [];
  budgetState?: BudgetState;

  removePosts(ids: Iterable<string>, reason: Tombstone["reason"], now: Date): number {
    let removed = 0;
    for (const id of ids) {
      if (this.posts.delete(id)) {
        removed += 1;
        this.tombstones.push({ postId: id, removedAt: now.toISOString(), reason });
      }
    }
    this.#dropEmptyStories();
    return removed;
  }

  /** Tombstones only need to live long enough for every client to sync once. */
  pruneTombstones(olderThan: Date): void {
    this.tombstones = this.tombstones.filter((t) => new Date(t.removedAt) >= olderThan);
  }

  snapshot(): Snapshot {
    return {
      posts: [...this.posts.values()],
      users: [...this.users.values()],
      stories: [...this.stories.values()],
      cursors: Object.fromEntries(this.cursors),
      lastPolledAt: Object.fromEntries(this.lastPolledAt),
      pausedUntil: this.pausedUntil?.toISOString(),
      tombstones: this.tombstones,
      budget: this.budgetState,
    };
  }

  static restore(snapshot: Snapshot): MemoryStore {
    const store = new MemoryStore();
    for (const p of snapshot.posts) store.posts.set(p.id, p);
    for (const u of snapshot.users) store.users.set(u.id, u);
    for (const s of snapshot.stories) store.stories.set(s.id, s);
    for (const [k, v] of Object.entries(snapshot.cursors)) store.cursors.set(k, v);
    for (const [k, v] of Object.entries(snapshot.lastPolledAt)) store.lastPolledAt.set(k, v);
    store.pausedUntil = snapshot.pausedUntil ? new Date(snapshot.pausedUntil) : undefined;
    store.tombstones = snapshot.tombstones;
    store.budgetState = snapshot.budget;
    return store;
  }

  #dropEmptyStories(): void {
    const used = new Set([...this.posts.values()].map((p) => p.storyId));
    for (const id of this.stories.keys()) {
      if (!used.has(id)) this.stories.delete(id);
    }
  }
}
