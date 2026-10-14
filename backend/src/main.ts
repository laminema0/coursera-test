import { readFileSync } from "node:fs";
import { NewsService } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createLogger } from "./log.ts";
import { loadServiceConfig } from "./service-config.ts";
import type { SourceList } from "./sources/types.ts";
import { migrateJsonSnapshots } from "./storage/migrate.ts";
import { SqliteStorage } from "./storage/sqlite.ts";
import { MemoryStorage, type Storage } from "./storage/storage.ts";

const service = loadServiceConfig();
const log = createLogger({ level: service.logLevel });

let storage: Storage | undefined;
let app: NewsService | undefined;

process.on("unhandledRejection", (reason) => log.error("unhandled promise rejection", { error: reason }));
process.on("uncaughtException", (error) => {
  // State may be inconsistent now: save nothing more, close the database cleanly and let the supervisor restart us.
  log.error("uncaught exception; exiting", { error });
  try {
    storage?.close();
  } finally {
    process.exit(1);
  }
});

try {
  const config = loadConfig();
  const sourceList = JSON.parse(readFileSync(service.sourcesFile, "utf8")) as SourceList;

  if (service.dbFile) {
    storage = new SqliteStorage(service.dbFile);
    migrateJsonSnapshots(storage, { dataDir: service.dataDir, xSnapshotFile: service.xSnapshotFile, log });
  } else {
    log.warn("no DATA_DIR / DATA_FILE / DB_FILE set: state is kept in memory only and lost on restart");
    storage = new MemoryStorage();
  }

  app = new NewsService({
    config,
    service,
    sourceList,
    storage,
    log,
    onStuck: () => {
      // The cycle hangs beyond any per-request timeout. Each cycle's state is committed atomically, so restarting is safe.
      log.error("watchdog: exiting so the supervisor restarts the service");
      try {
        storage?.close();
      } finally {
        process.exit(1);
      }
    },
  });
  await app.start(config.port, process.env.HOST || undefined);
} catch (error) {
  log.error("startup failed", { error });
  storage?.close();
  process.exit(1);
}

let signals = 0;
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    signals += 1;
    if (signals > 1) {
      log.warn("second signal; exiting immediately", { signal });
      process.exit(1);
    }
    void app!.stop(signal).then(() => process.exit(0), (error: unknown) => {
      log.error("shutdown failed", { error });
      process.exit(1);
    });
  });
}
