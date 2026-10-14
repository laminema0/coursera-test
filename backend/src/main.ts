import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type HistorySnapshot, StatusHistory } from "./analysis/history.ts";
import { TrackRecord, type TrackRecordSnapshot } from "./analysis/track-record.ts";
import { analyze } from "./analysis/verify.ts";
import { DailyBudget } from "./budget.ts";
import { type EventsResponse, toApiEvents } from "./events-api.ts";
import { CoverageTracker } from "./sources/gdelt.ts";
import { loadConfig } from "./config.ts";
import { Ingestor } from "./ingest.ts";
import { createApiServer } from "./server.ts";
import { ArticleStore, type ArticleSnapshot } from "./sources/article-store.ts";
import { Collector } from "./sources/collector.ts";
import type { SourceList } from "./sources/types.ts";
import { MemoryStore, type Snapshot } from "./store.ts";
import { XClient } from "./x/client.ts";

const config = loadConfig();
const sourceList = JSON.parse(readFileSync(process.env.SOURCES_FILE ?? "sources/en.json", "utf8")) as SourceList;
const dataDir = config.dataFile ? dirname(config.dataFile) : undefined;

const articlesFile = dataDir ? join(dataDir, "articles.json") : undefined;
const articles = articlesFile && existsSync(articlesFile)
  ? ArticleStore.restore(JSON.parse(readFileSync(articlesFile, "utf8")) as ArticleSnapshot)
  : new ArticleStore();
const collector = new Collector({ sources: sourceList.sources, language: sourceList.language, store: articles });
const sourceMap = new Map(sourceList.sources.map((s) => [s.id, s]));
let latestEvents: EventsResponse | undefined;
const trackRecordFile = dataDir ? join(dataDir, "track-record.json") : undefined;
const trackRecord = trackRecordFile && existsSync(trackRecordFile)
  ? TrackRecord.restore(JSON.parse(readFileSync(trackRecordFile, "utf8")) as TrackRecordSnapshot)
  : new TrackRecord();
const historyFile = dataDir ? join(dataDir, "status-history.json") : undefined;
const statusHistory = historyFile && existsSync(historyFile)
  ? StatusHistory.restore(JSON.parse(readFileSync(historyFile, "utf8")) as HistorySnapshot)
  : new StatusHistory();
const coverage = new CoverageTracker();
const GDELT_ENABLED = process.env.GDELT !== "off";

async function analyzeNow(): Promise<void> {
  const started = Date.now();
  const all = [...articles.articles.values()];
  const events = analyze(all, sourceMap);
  if (statusHistory.record(events, new Date())) save(historyFile, statusHistory.snapshot());
  const publish = () => {
    latestEvents = toApiEvents(events, articles.articles, sourceMap, new Date(), (id) => coverage.get(id), (id) => statusHistory.get(id));
  };
  publish();
  if (trackRecord.update(events, new Date()) > 0) save(trackRecordFile, trackRecord.snapshot());
  const byStatus = events.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.verification.status]: (acc[e.verification.status] ?? 0) + 1 }), {});
  console.log(`[analysis] ${all.length} articles → ${events.length} events in ${Date.now() - started} ms ${JSON.stringify(byStatus)}`);

  if (GDELT_ENABLED) {
    // Coverage for the newest multi-source events; GDELT allows about one request every 5 seconds.
    coverage.retain(new Set(events.map((e) => e.id)));
    const top = events.filter((e) => e.verification.confirming >= 2 || e.verification.signals > 0).slice(0, 5);
    const checked = await coverage.refresh(top, 5);
    if (checked > 0) {
      publish();
      console.log(`[gdelt] coverage updated for ${checked} events`);
    }
  }
}

// Optional, paid: X ingestion runs only when a token is configured.
let xStore: MemoryStore | undefined;
let ingestor: Ingestor | undefined;
if (config.xBearerToken) {
  xStore = config.dataFile && existsSync(config.dataFile)
    ? MemoryStore.restore(JSON.parse(readFileSync(config.dataFile, "utf8")) as Snapshot)
    : new MemoryStore();
  ingestor = new Ingestor({
    config,
    client: new XClient({ bearerToken: config.xBearerToken, baseUrl: config.xApiBaseUrl }),
    store: xStore,
    budget: new DailyBudget(config.dailyBudgetUsd, config.prices, () => new Date(), xStore.budgetState),
    log: (message) => console.log(`[x] ${message}`),
  });
}

function save(file: string | undefined, data: unknown): void {
  if (!file) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(data));
  renameSync(`${file}.tmp`, file);
}

let running = false;
async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const report = await collector.runCycle();
    console.log(`[sources] attempted=${report.attempted} new=${report.newArticles} notModified=${report.notModified} failed=${report.failed.length} expired=${report.expired}`);
    for (const f of report.failed) console.log(`[sources]   ${f.sourceId}: ${f.error}`);
    save(articlesFile, articles.snapshot());
    await analyzeNow();

    if (ingestor && xStore) {
      console.log(`[x] ${JSON.stringify(await ingestor.runCycle())}`);
      save(config.dataFile, xStore.snapshot());
    }
  } catch (error) {
    console.error("[tick] failed:", error);
  } finally {
    running = false;
  }
}

createApiServer({ articles, sources: sourceList.sources, xStore, events: () => latestEvents, trackRecord }).listen(config.port, () => {
  console.log(`API on http://localhost:${config.port}  (/v1/events, /v1/articles, /v1/sources${xStore ? ", /v1/feed" : ""})`);
  console.log(`${sourceList.sources.length} free sources loaded; X integration ${xStore ? "ON" : "off"}`);
});
void tick();
setInterval(() => void tick(), 60_000);
