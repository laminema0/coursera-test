import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DailyBudget } from "./budget.ts";
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

createApiServer({ articles, sources: sourceList.sources, xStore }).listen(config.port, () => {
  console.log(`API on http://localhost:${config.port}  (/v1/articles, /v1/sources${xStore ? ", /v1/feed" : ""})`);
  console.log(`${sourceList.sources.length} free sources loaded; X integration ${xStore ? "ON" : "off"}`);
});
void tick();
setInterval(() => void tick(), 60_000);
