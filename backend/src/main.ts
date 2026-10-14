import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DailyBudget } from "./budget.ts";
import { loadConfig } from "./config.ts";
import { Ingestor } from "./ingest.ts";
import { createApiServer } from "./server.ts";
import { MemoryStore, type Snapshot } from "./store.ts";
import { XClient } from "./x/client.ts";

const config = loadConfig();
const store = config.dataFile && existsSync(config.dataFile)
  ? MemoryStore.restore(JSON.parse(readFileSync(config.dataFile, "utf8")) as Snapshot)
  : new MemoryStore();
const budget = new DailyBudget(config.dailyBudgetUsd, config.prices, () => new Date(), store.budgetState);
const ingestor = new Ingestor({
  config,
  client: new XClient({ bearerToken: config.xBearerToken, baseUrl: config.xApiBaseUrl }),
  store,
  budget,
  log: (message) => console.log(`[ingest] ${message}`),
});

let running = false;
async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const report = await ingestor.runCycle();
    console.log(`[ingest] ${JSON.stringify(report)}`);
    if (config.dataFile) {
      mkdirSync(dirname(config.dataFile), { recursive: true });
      const temp = `${config.dataFile}.tmp`;
      writeFileSync(temp, JSON.stringify(store.snapshot()));
      renameSync(temp, config.dataFile);
    }
  } catch (error) {
    console.error("[ingest] cycle failed:", error);
  } finally {
    running = false;
  }
}

createApiServer(store).listen(config.port, () => console.log(`Feed API on http://localhost:${config.port}/v1/feed`));
void tick();
setInterval(() => void tick(), 60_000);
