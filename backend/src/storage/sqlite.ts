import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import type { SourceRecord } from "../analysis/track-record.ts";
import type { BudgetState } from "../budget.ts";
import type { SourceState } from "../sources/article-store.ts";
import type { Article } from "../sources/types.ts";
import type { StoredPost, StoredUser, Story, Tombstone } from "../store.ts";
import { type CommitStats, emptyState, type PersistedState, type Storage } from "./storage.ts";

const SCHEMA_VERSION = 1;

// Row kinds in the generic `records` table, grouped by the state part that owns them.
const PART_KINDS: Record<keyof PersistedState, string[]> = {
  articles: ["article", "source_state"],
  trackRecord: ["tr_source", "tr_evaluated"],
  history: ["history"],
  x: ["x_post", "x_user", "x_story", "x_meta"],
};

type Rows = Map<string, Map<string, unknown>>;

/**
 * SQLite storage via Node's built-in `node:sqlite` (no native addon to build on the VM).
 * Write-ahead logging; each commit is one IMMEDIATE transaction that only writes rows whose JSON changed.
 */
export class SqliteStorage implements Storage {
  readonly kind = "sqlite";
  readonly #db: DatabaseSync;
  /** Last written JSON per kind → id, to skip unchanged rows. Mirrors the database. */
  readonly #written = new Map<string, Map<string, string>>();
  readonly #stmt: Record<"upsertArticle" | "deleteArticle" | "upsertRecord" | "deleteRecord" | "getMeta" | "setMeta", StatementSync>;
  #closed = false;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.#db = new DatabaseSync(path);
    this.#db.exec(`
      PRAGMA auto_vacuum = INCREMENTAL;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        fetched_at TEXT NOT NULL,
        published_at TEXT NOT NULL,
        data TEXT NOT NULL
      ) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS articles_fetched_at ON articles (fetched_at);
      CREATE TABLE IF NOT EXISTS records (
        kind TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (kind, id)
      ) WITHOUT ROWID;
    `);
    const version = Number(this.#db.prepare("PRAGMA user_version").get()?.user_version ?? 0);
    if (version > SCHEMA_VERSION) throw new Error(`Database schema v${version} is newer than this build (v${SCHEMA_VERSION})`);
    if (version < SCHEMA_VERSION) this.#db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);

    this.#stmt = {
      upsertArticle: this.#db.prepare(
        "INSERT INTO articles (id, fetched_at, published_at, data) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT (id) DO UPDATE SET fetched_at = excluded.fetched_at, published_at = excluded.published_at, data = excluded.data",
      ),
      deleteArticle: this.#db.prepare("DELETE FROM articles WHERE id = ?"),
      upsertRecord: this.#db.prepare(
        "INSERT INTO records (kind, id, data, updated_at) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT (kind, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
      ),
      deleteRecord: this.#db.prepare("DELETE FROM records WHERE kind = ? AND id = ?"),
      getMeta: this.#db.prepare("SELECT value FROM meta WHERE key = ?"),
      setMeta: this.#db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value"),
    };

    for (const row of this.#db.prepare("SELECT id, data FROM articles").iterate()) {
      this.#cache("article").set(String(row.id), String(row.data));
    }
    for (const row of this.#db.prepare("SELECT kind, id, data FROM records").iterate()) {
      this.#cache(String(row.kind)).set(String(row.id), String(row.data));
    }
  }

  load(): PersistedState {
    const rows: Rows = new Map();
    for (const [kind, entries] of this.#written) {
      const parsed = new Map<string, unknown>();
      for (const [id, json] of entries) parsed.set(id, JSON.parse(json));
      rows.set(kind, parsed);
    }
    return fromRows(rows);
  }

  commit(state: Partial<PersistedState>): CommitStats {
    this.#assertOpen();
    const rows = toRows(state);
    const kinds = (Object.keys(state) as (keyof PersistedState)[]).filter((p) => state[p] !== undefined).flatMap((p) => PART_KINDS[p]);
    const now = new Date().toISOString();
    const pending: [kind: string, id: string, json: string | undefined][] = [];
    const stats: CommitStats = { upserted: 0, deleted: 0 };

    this.#db.exec("BEGIN IMMEDIATE");
    try {
      for (const kind of kinds) {
        const next = rows.get(kind) ?? new Map<string, unknown>();
        const written = this.#cache(kind);
        for (const [id, value] of next) {
          const json = JSON.stringify(value);
          if (written.get(id) === json) continue;
          if (kind === "article") {
            const a = value as Article;
            this.#stmt.upsertArticle.run(id, a.fetchedAt, a.publishedAt, json);
          } else {
            this.#stmt.upsertRecord.run(kind, id, json, now);
          }
          pending.push([kind, id, json]);
          stats.upserted += 1;
        }
        for (const id of written.keys()) {
          if (next.has(id)) continue;
          if (kind === "article") this.#stmt.deleteArticle.run(id);
          else this.#stmt.deleteRecord.run(kind, id);
          pending.push([kind, id, undefined]);
          stats.deleted += 1;
        }
      }
      this.#db.exec("COMMIT");
    } catch (error) {
      if (this.#db.isTransaction) this.#db.exec("ROLLBACK");
      throw error;
    }
    for (const [kind, id, json] of pending) {
      if (json === undefined) this.#cache(kind).delete(id);
      else this.#cache(kind).set(id, json);
    }
    return stats;
  }

  cleanup(options: { articlesFetchedBefore: Date }): number {
    this.#assertOpen();
    const cutoff = options.articlesFetchedBefore.toISOString();
    const expired = this.#db.prepare("SELECT id FROM articles WHERE fetched_at < ?").all(cutoff).map((r) => String(r.id));
    if (expired.length > 0) {
      this.#db.prepare("DELETE FROM articles WHERE fetched_at < ?").run(cutoff);
      for (const id of expired) this.#cache("article").delete(id);
    }
    // Give freed pages back to the filesystem a little at a time, and keep the WAL file from growing.
    this.#db.exec("PRAGMA incremental_vacuum(1000)");
    this.#db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    return expired.length;
  }

  getMeta(key: string): string | undefined {
    const row = this.#stmt.getMeta.get(key);
    return row ? String(row.value) : undefined;
  }

  setMeta(key: string, value: string): void {
    this.#stmt.setMeta.run(key, value);
  }

  /** Counts per kind, for diagnostics and tests. */
  counts(): Record<string, number> {
    return Object.fromEntries([...this.#written].map(([kind, rows]) => [kind, rows.size]));
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    try {
      this.#db.exec("PRAGMA optimize");
      this.#db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    } finally {
      this.#db.close();
    }
  }

  #cache(kind: string): Map<string, string> {
    let map = this.#written.get(kind);
    if (!map) {
      map = new Map();
      this.#written.set(kind, map);
    }
    return map;
  }

  #assertOpen(): void {
    if (this.#closed) throw new Error("Storage is closed");
  }
}

// X meta rows: single values stored under fixed ids.
const X_META = ["cursors", "last_polled_at", "paused_until", "tombstones", "budget"] as const;

function toRows(state: Partial<PersistedState>): Rows {
  const rows: Rows = new Map();
  const put = (kind: string, id: string, value: unknown) => {
    if (value === undefined) return;
    let map = rows.get(kind);
    if (!map) rows.set(kind, (map = new Map()));
    map.set(id, value);
  };

  if (state.articles) {
    for (const a of state.articles.articles) put("article", a.id, a);
    for (const [id, s] of Object.entries(state.articles.sourceState)) put("source_state", id, s);
  }
  if (state.trackRecord) {
    for (const [id, r] of Object.entries(state.trackRecord.sources)) put("tr_source", id, r);
    for (const id of state.trackRecord.evaluatedEventIds) put("tr_evaluated", id, 1);
  }
  if (state.history) {
    for (const [id, changes] of Object.entries(state.history)) put("history", id, changes);
  }
  if (state.x) {
    const x = state.x;
    for (const p of x.posts) put("x_post", p.id, p);
    for (const u of x.users) put("x_user", u.id, u);
    for (const s of x.stories) put("x_story", s.id, s);
    put("x_meta", "cursors", x.cursors);
    put("x_meta", "last_polled_at", x.lastPolledAt);
    put("x_meta", "paused_until", x.pausedUntil);
    put("x_meta", "tombstones", x.tombstones);
    put("x_meta", "budget", x.budget);
  }
  return rows;
}

function fromRows(rows: Rows): PersistedState {
  const values = <T>(kind: string) => [...(rows.get(kind)?.values() ?? [])] as T[];
  const entries = <T>(kind: string) => Object.fromEntries(rows.get(kind) ?? []) as Record<string, T>;
  const state = emptyState();
  state.articles = { articles: values<Article>("article"), sourceState: entries<SourceState>("source_state") };
  state.trackRecord = { sources: entries<SourceRecord>("tr_source"), evaluatedEventIds: [...(rows.get("tr_evaluated")?.keys() ?? [])] };
  state.history = entries("history");

  const meta = rows.get("x_meta");
  const hasX = rows.get("x_post")?.size || rows.get("x_user")?.size || rows.get("x_story")?.size || meta?.size;
  if (hasX) {
    const m = <T>(id: (typeof X_META)[number]) => meta?.get(id) as T | undefined;
    state.x = {
      posts: values<StoredPost>("x_post"),
      users: values<StoredUser>("x_user"),
      stories: values<Story>("x_story"),
      cursors: m<Record<string, string>>("cursors") ?? {},
      lastPolledAt: m<Record<string, string>>("last_polled_at") ?? {},
      pausedUntil: m<string>("paused_until"),
      tombstones: m<Tombstone[]>("tombstones") ?? [],
      budget: m<BudgetState>("budget"),
    };
  }
  return state;
}
