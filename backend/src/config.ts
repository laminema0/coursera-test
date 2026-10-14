import { readFileSync } from "node:fs";

export interface SourceGroup {
  id: string;
  label: string;
  /** X usernames without "@". Curated news publishers and journalists only. */
  accounts: string[];
  pollMinutes: number;
  /** 10–100. Upper bound of posts (and so cost) per poll. */
  maxResultsPerPoll: number;
}

export interface Prices {
  /** USD per post read. Check the X Developer Console; prices change. */
  postRead: number;
  /** USD per user read. */
  userRead: number;
}

export interface Config {
  xBearerToken: string;
  xApiBaseUrl: string;
  groups: SourceGroup[];
  dailyBudgetUsd: number;
  prices: Prices;
  /** How long an X post stays in the feed. Short retention keeps compliance re-checks cheap. */
  retentionHours: number;
  /** How often each stored post is re-checked for deletion (X policy: remove within 24h). */
  complianceCheckMinutes: number;
  /** How often author profiles (name, avatar, verified) are refreshed. */
  profileRefreshHours: number;
  /** On the very first poll of a query, only fetch posts this recent. */
  firstRunLookbackMinutes: number;
  /** Max characters in one search query. 512 is the safe lower bound across X access levels. */
  maxQueryLength: number;
  maxPagesPerPoll: number;
  port: number;
  dataFile?: string;
}

export const defaultPrices: Prices = { postRead: 0.005, userRead: 0.01 };

/** X is optional (paid). With no X_BEARER_TOKEN, `xBearerToken` is empty and X ingestion stays off. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env, sourcesPath = "sources/x-accounts.json"): Config {
  const token = env.X_BEARER_TOKEN ?? "";
  const sources = JSON.parse(readFileSync(sourcesPath, "utf8")) as { groups: SourceGroup[] };

  return {
    xBearerToken: token,
    xApiBaseUrl: env.X_API_BASE_URL ?? "https://api.x.com/2",
    groups: sources.groups,
    dailyBudgetUsd: numberFrom(env.DAILY_BUDGET_USD, 1),
    prices: {
      postRead: numberFrom(env.PRICE_POST_READ, defaultPrices.postRead),
      userRead: numberFrom(env.PRICE_USER_READ, defaultPrices.userRead),
    },
    retentionHours: numberFrom(env.RETENTION_HOURS, 24),
    complianceCheckMinutes: numberFrom(env.COMPLIANCE_CHECK_MINUTES, 60),
    profileRefreshHours: numberFrom(env.PROFILE_REFRESH_HOURS, 72),
    firstRunLookbackMinutes: numberFrom(env.FIRST_RUN_LOOKBACK_MINUTES, 120),
    maxQueryLength: numberFrom(env.MAX_QUERY_LENGTH, 512),
    maxPagesPerPoll: numberFrom(env.MAX_PAGES_PER_POLL, 3),
    port: numberFrom(env.PORT, 8787),
    dataFile: env.DATA_FILE || undefined,
  };
}

function numberFrom(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(parsed) ? parsed : fallback;
}
