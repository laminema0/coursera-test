import { dirname, join } from "node:path";
import { type LogLevel, parseLogLevel } from "./log.ts";

/** Who may set the client address via CF-Connecting-IP / X-Forwarded-For. */
export type TrustProxy = "loopback" | "private" | "none";

/** Runtime settings of the free-source service (X settings live in config.ts). All from environment variables. */
export interface ServiceConfig {
  logLevel: LogLevel;
  sourcesFile: string;
  /** Folder for the database (and, from older versions, JSON snapshots). Unset: state lives in memory only. */
  dataDir?: string;
  /** SQLite file. Defaults to `<dataDir>/news.db`. ":memory:" is allowed. */
  dbFile?: string;
  /** Old X snapshot file (DATA_FILE), imported once. */
  xSnapshotFile?: string;
  cycleIntervalMs: number;
  /** After this long a cycle skips its remaining optional stages; after twice this long the process exits for a restart. */
  cycleTimeoutMs: number;
  shutdownTimeoutMs: number;
  articleRetentionHours: number;
  gdelt: boolean;
  /** Allowed browser origins. Empty = CORS off (the iOS app doesn't need it). "*" allows any. */
  corsOrigins: string[];
  trustProxy: TrustProxy;
  /** When set, /metrics also accepts `Authorization: Bearer <token>` from outside. */
  metricsToken?: string;
  rateLimitPerMinute: number;
}

export function loadServiceConfig(env: NodeJS.ProcessEnv = process.env): ServiceConfig {
  const dataDir = env.DATA_DIR || (env.DATA_FILE ? dirname(env.DATA_FILE) : undefined);
  const trust = env.TRUST_PROXY?.trim().toLowerCase();
  return {
    logLevel: parseLogLevel(env.LOG_LEVEL),
    sourcesFile: env.SOURCES_FILE || "sources/en.json",
    dataDir,
    dbFile: env.DB_FILE || (dataDir ? join(dataDir, "news.db") : undefined),
    xSnapshotFile: env.DATA_FILE || undefined,
    cycleIntervalMs: seconds(env.CYCLE_INTERVAL_SECONDS, 60),
    cycleTimeoutMs: seconds(env.CYCLE_TIMEOUT_SECONDS, 300),
    shutdownTimeoutMs: seconds(env.SHUTDOWN_TIMEOUT_SECONDS, 45),
    articleRetentionHours: positive(env.ARTICLE_RETENTION_HOURS, 72),
    gdelt: env.GDELT !== "off",
    corsOrigins: (env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
    trustProxy: trust === "private" || trust === "none" ? trust : "loopback",
    metricsToken: env.METRICS_TOKEN || undefined,
    rateLimitPerMinute: positive(env.RATE_LIMIT_PER_MINUTE, 120),
  };
}

function positive(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value && Number.isFinite(n) && n > 0 ? n : fallback;
}

const seconds = (value: string | undefined, fallback: number) => positive(value, fallback) * 1000;
