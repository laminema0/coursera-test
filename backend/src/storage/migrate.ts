import { existsSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "../log.ts";
import type { PersistedState, Storage } from "./storage.ts";

const MIGRATED_KEY = "json_snapshots_migrated_at";

/**
 * One-time import of the JSON snapshots written by earlier versions (data/articles.json, track-record.json,
 * status-history.json and the X snapshot at DATA_FILE). Imported files are renamed to `*.migrated` as a backup.
 * A file that can't be parsed is left in place and skipped; it never stops the service from starting.
 */
export function migrateJsonSnapshots(storage: Storage, options: { dataDir?: string; xSnapshotFile?: string; log: Logger; now?: Date }): string[] {
  if (storage.getMeta(MIGRATED_KEY)) return [];
  const files: Record<keyof PersistedState, string | undefined> = {
    articles: options.dataDir && join(options.dataDir, "articles.json"),
    trackRecord: options.dataDir && join(options.dataDir, "track-record.json"),
    history: options.dataDir && join(options.dataDir, "status-history.json"),
    x: options.xSnapshotFile,
  };

  const state: Partial<PersistedState> = {};
  const imported: string[] = [];
  for (const [part, file] of Object.entries(files) as [keyof PersistedState, string | undefined][]) {
    if (!file || !existsSync(file)) continue;
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
      if (!isPlausible(part, parsed)) throw new Error("unexpected shape");
      (state as Record<string, unknown>)[part] = parsed;
      imported.push(file);
    } catch (error) {
      options.log.warn("migration: skipping unreadable snapshot", { file, error });
    }
  }

  if (imported.length > 0) {
    const stats = storage.commit(state);
    options.log.info("migration: imported JSON snapshots", { files: imported, rows: stats.upserted });
  }
  storage.setMeta(MIGRATED_KEY, (options.now ?? new Date()).toISOString());
  for (const file of imported) {
    try {
      renameSync(file, `${file}.migrated`);
    } catch (error) {
      options.log.warn("migration: could not rename imported file", { file, error });
    }
  }
  return imported;
}

function isPlausible(part: keyof PersistedState, value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  switch (part) {
    case "articles": return Array.isArray(v.articles) && typeof v.sourceState === "object";
    case "trackRecord": return typeof v.sources === "object" && Array.isArray(v.evaluatedEventIds);
    case "history": return !Array.isArray(v);
    case "x": return Array.isArray(v.posts) && Array.isArray(v.users) && Array.isArray(v.stories);
  }
}
