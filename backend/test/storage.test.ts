import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { silentLogger } from "../src/log.ts";
import { migrateJsonSnapshots } from "../src/storage/migrate.ts";
import { SqliteStorage } from "../src/storage/sqlite.ts";
import { MemoryStorage, type PersistedState } from "../src/storage/storage.ts";
import type { Article } from "../src/sources/types.ts";
import type { Snapshot } from "../src/store.ts";
import { articles } from "./fixtures/breaking.ts";

function tempDir(t: { after: (fn: () => void) => void }): string {
  const dir = mkdtempSync(join(tmpdir(), "nv-storage-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const xSnapshot: Snapshot = {
  posts: [{ id: "1", text: "hi", authorId: "u1", createdAt: "2026-10-14T10:00:00Z", possiblySensitive: false, storyId: "s1", fetchedAt: "2026-10-14T10:00:00Z", verifiedAt: "2026-10-14T10:00:00Z" }],
  users: [{ id: "u1", username: "reuters", name: "Reuters", verified: true, refreshedAt: "2026-10-14T10:00:00Z" }],
  stories: [{ id: "s1", url: "https://a.test/x", publisher: "a.test", firstSeenAt: "2026-10-14T10:00:00Z", lastActivityAt: "2026-10-14T10:00:00Z" }],
  cursors: { q: "1" },
  lastPolledAt: { news: "2026-10-14T10:00:00Z" },
  pausedUntil: undefined,
  tombstones: [{ postId: "0", removedAt: "2026-10-14T09:00:00Z", reason: "deleted" }],
  budget: { day: "2026-10-14", spentUsd: 0.25, seenPosts: ["1"], seenUsers: [] },
};

const fullState = (): PersistedState => ({
  articles: { articles: articles.slice(0, 5), sourceState: { bbc: { consecutiveFailures: 0, etag: "\"abc\"" } } },
  trackRecord: { sources: { bbc: { numbersChecked: 1, numbersClose: 1, numbersHigh: 0, numbersLow: 0, disputedOrRetracted: 0, eventsSettled: 1 } }, evaluatedEventIds: ["e1"] },
  history: { e1: [{ status: "reported", at: "2026-10-14T09:00:00Z", confirming: 1 }] },
  x: xSnapshot,
});

const sorted = (s: PersistedState) => ({ ...s, articles: { ...s.articles, articles: [...s.articles.articles].sort((a, b) => a.id.localeCompare(b.id)) } });

test("SQLite storage round-trips every part of the state and survives reopening", (t) => {
  const file = join(tempDir(t), "nested", "news.db");
  const db = new SqliteStorage(file);
  assert.deepEqual(db.load().articles.articles, []);
  assert.equal(db.load().x, undefined);
  db.commit(fullState());
  db.close();

  const reopened = new SqliteStorage(file);
  t.after(() => reopened.close());
  const loaded = reopened.load();
  const expected = fullState();
  // JSON drops undefined fields, so compare through JSON.
  assert.deepEqual(JSON.parse(JSON.stringify(sorted(loaded))), JSON.parse(JSON.stringify(sorted(expected))));
});

test("SQLite storage uses write-ahead logging", (t) => {
  const file = join(tempDir(t), "news.db");
  const db = new SqliteStorage(file);
  db.commit(fullState());
  const raw = new DatabaseSync(file);
  assert.equal(raw.prepare("PRAGMA journal_mode").get()?.journal_mode, "wal");
  raw.close();
  db.close();
});

test("commits write only changed rows and delete rows that disappeared", () => {
  const db = new SqliteStorage(":memory:");
  const state = fullState();
  const first = db.commit(state);
  assert.ok(first.upserted >= 5);

  assert.deepEqual(db.commit(state), { upserted: 0, deleted: 0 });

  const changed = structuredClone(state);
  changed.articles.articles[0]!.sourceIds.push("extra");
  changed.articles.articles.pop();
  assert.deepEqual(db.commit({ articles: changed.articles }), { upserted: 1, deleted: 1 });
  assert.equal(db.load().articles.articles.length, 4);
  // Parts left out of a commit are untouched.
  assert.equal(db.load().x?.posts.length, 1);
  db.close();
});

test("a failing commit rolls back the whole batch", () => {
  const db = new SqliteStorage(":memory:");
  db.commit(fullState());
  const bad = structuredClone(fullState());
  bad.articles.articles = [
    ...bad.articles.articles.map((a) => ({ ...a, title: `${a.title} (edited)` })),
    { id: "boom", toJSON() { throw new Error("cannot serialize"); } } as unknown as Article,
  ];
  assert.throws(() => db.commit(bad), /cannot serialize/);
  assert.ok(db.load().articles.articles.every((a) => !a.title.endsWith("(edited)")));
  // The cache still matches the database: re-committing the original state changes nothing.
  assert.deepEqual(db.commit(fullState()), { upserted: 0, deleted: 0 });
  db.close();
});

test("cleanup deletes articles past retention", () => {
  const db = new SqliteStorage(":memory:");
  db.commit(fullState());
  const removed = db.cleanup({ articlesFetchedBefore: new Date("2026-10-14T09:30:00Z") });
  assert.ok(removed > 0);
  assert.ok(db.load().articles.articles.every((a) => a.fetchedAt >= "2026-10-14T09:30:00.000Z"));
  db.close();
});

test("refuses to open a database from a newer schema version", (t) => {
  const file = join(tempDir(t), "news.db");
  const raw = new DatabaseSync(file);
  raw.exec("PRAGMA user_version = 99");
  raw.close();
  assert.throws(() => new SqliteStorage(file), /newer than this build/);
});

test("memory storage keeps the last committed state (deep copied)", () => {
  const storage = new MemoryStorage();
  const state = fullState();
  storage.commit(state);
  state.articles.articles.length = 0;
  assert.equal(storage.load().articles.articles.length, 5);
  assert.equal(storage.cleanup({ articlesFetchedBefore: new Date("2030-01-01") }), 5);
});

test("migrates the old JSON snapshots once and keeps them as *.migrated", (t) => {
  const dir = tempDir(t);
  const state = fullState();
  writeFileSync(join(dir, "articles.json"), JSON.stringify(state.articles));
  writeFileSync(join(dir, "track-record.json"), JSON.stringify(state.trackRecord));
  writeFileSync(join(dir, "status-history.json"), JSON.stringify(state.history));
  writeFileSync(join(dir, "snapshot.json"), JSON.stringify(state.x));

  const db = new SqliteStorage(join(dir, "news.db"));
  const imported = migrateJsonSnapshots(db, { dataDir: dir, xSnapshotFile: join(dir, "snapshot.json"), log: silentLogger });
  assert.equal(imported.length, 4);
  assert.ok(existsSync(join(dir, "articles.json.migrated")));
  assert.ok(!existsSync(join(dir, "articles.json")));

  const loaded = db.load();
  assert.equal(loaded.articles.articles.length, 5);
  assert.deepEqual(loaded.trackRecord.evaluatedEventIds, ["e1"]);
  assert.equal(loaded.history.e1?.[0]?.status, "reported");
  assert.equal(loaded.x?.budget?.spentUsd, 0.25);

  // Second run is a no-op even if a file shows up again.
  writeFileSync(join(dir, "articles.json"), JSON.stringify({ articles: [], sourceState: {} }));
  assert.deepEqual(migrateJsonSnapshots(db, { dataDir: dir, log: silentLogger }), []);
  assert.equal(db.load().articles.articles.length, 5);
  db.close();
});

test("migration skips a corrupt snapshot without failing", (t) => {
  const dir = tempDir(t);
  writeFileSync(join(dir, "articles.json"), "{not json");
  writeFileSync(join(dir, "status-history.json"), JSON.stringify(fullState().history));
  const lines: string[] = [];
  const log = { ...silentLogger, warn: (msg: string) => lines.push(msg) };
  const db = new SqliteStorage(":memory:");
  assert.deepEqual(migrateJsonSnapshots(db, { dataDir: dir, log }), [join(dir, "status-history.json")]);
  assert.equal(readFileSync(join(dir, "articles.json"), "utf8"), "{not json");
  assert.ok(lines.some((l) => l.includes("unreadable")));
  db.close();
});
