import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { StatusHistory } from "./analysis/history.ts";
import { TrackRecord } from "./analysis/track-record.ts";
import { analyze } from "./analysis/verify.ts";
import { DailyBudget } from "./budget.ts";
import type { Config } from "./config.ts";
import { type EventsResponse, toApiEvents } from "./events-api.ts";
import { Ingestor } from "./ingest.ts";
import type { Logger } from "./log.ts";
import { createMetrics, type Metrics } from "./metrics.ts";
import { RateLimiter } from "./rate-limit.ts";
import { createApiServer } from "./server.ts";
import type { ServiceConfig } from "./service-config.ts";
import { ArticleStore } from "./sources/article-store.ts";
import { Collector } from "./sources/collector.ts";
import { CoverageTracker } from "./sources/gdelt.ts";
import type { NewsSource, SourceList } from "./sources/types.ts";
import type { Storage } from "./storage/storage.ts";
import { MemoryStore } from "./store.ts";
import { XClient } from "./x/client.ts";

export interface ServiceOptions {
  /** X settings (X stays off without a bearer token). */
  config: Config;
  service: ServiceConfig;
  sourceList: SourceList;
  storage: Storage;
  log: Logger;
  metrics?: Metrics;
  /** Used for feeds and GDELT. */
  fetch?: typeof fetch;
  now?: () => Date;
  /** Minimum gap between GDELT requests (default 6 s; GDELT asks for ≥ 5 s). */
  gdeltIntervalMs?: number;
  /** Called when a cycle is still running after twice the cycle timeout. main.ts exits so the supervisor restarts it. */
  onStuck?: () => void;
}

export type CycleResult = "ok" | "error" | "timeout" | "skipped";

const STATUSES = ["unverified", "reported", "corroborated", "confirmed", "disputed", "retracted"];
const CLEANUP_EVERY_MS = 60 * 60_000;

/**
 * The whole backend: collect free sources → analyze → persist → serve. One instance per process.
 * State lives in memory while running; storage gets one atomic, diffed commit per cycle.
 */
export class NewsService {
  readonly articles: ArticleStore;
  readonly trackRecord: TrackRecord;
  readonly statusHistory: StatusHistory;
  readonly coverage: CoverageTracker;
  readonly metrics: Metrics;
  readonly server: Server;
  readonly xStore?: MemoryStore;
  latestEvents?: EventsResponse;

  readonly #o: ServiceOptions;
  readonly #log: Logger;
  readonly #now: () => Date;
  readonly #collector: Collector;
  readonly #sourceMap: Map<string, NewsSource>;
  readonly #ingestor?: Ingestor;
  #current?: Promise<CycleResult>;
  #interval?: NodeJS.Timeout;
  #stopping = false;
  #lastCleanup = 0;

  constructor(options: ServiceOptions) {
    this.#o = options;
    this.#log = options.log;
    this.#now = options.now ?? (() => new Date());
    this.metrics = options.metrics ?? createMetrics();
    this.metrics.startTime.set(Math.floor(Date.now() / 1000));
    this.metrics.ready.set(0);

    const state = options.storage.load();
    this.articles = ArticleStore.restore(state.articles);
    this.trackRecord = TrackRecord.restore(state.trackRecord);
    this.statusHistory = StatusHistory.restore(state.history);
    this.#sourceMap = new Map(options.sourceList.sources.map((s) => [s.id, s]));
    this.#collector = new Collector({
      sources: options.sourceList.sources,
      language: options.sourceList.language,
      store: this.articles,
      fetch: options.fetch,
      now: this.#now,
      retentionHours: options.service.articleRetentionHours,
    });
    this.coverage = new CoverageTracker({ fetch: this.#countingFetch(options.fetch ?? fetch), now: this.#now, intervalMs: options.gdeltIntervalMs });

    const { config } = options;
    if (config.xBearerToken) {
      this.xStore = state.x ? MemoryStore.restore(state.x) : new MemoryStore();
      const xLog = this.#log.child({ component: "x" });
      this.#ingestor = new Ingestor({
        config,
        client: new XClient({ bearerToken: config.xBearerToken, baseUrl: config.xApiBaseUrl }),
        store: this.xStore,
        budget: new DailyBudget(config.dailyBudgetUsd, config.prices, this.#now, this.xStore.budgetState),
        now: this.#now,
        log: (message) => xLog.info(message),
      });
    }

    this.server = createApiServer({
      articles: this.articles,
      sources: options.sourceList.sources,
      xStore: this.xStore,
      events: () => this.latestEvents,
      trackRecord: this.trackRecord,
      now: this.#now,
      metrics: this.metrics,
      log: this.#log.child({ component: "http" }),
      corsOrigins: options.service.corsOrigins,
      trustProxy: options.service.trustProxy,
      trustForwardedFor: options.service.trustForwardedFor,
      metricsToken: options.service.metricsToken,
      rateLimiter: new RateLimiter(options.service.rateLimitPerMinute),
    });
    this.metrics.articles.set(this.articles.articles.size);
  }

  /** Starts serving and collecting. Restored articles are analyzed first so /ready turns green without waiting for feeds. */
  async start(port: number, host?: string): Promise<AddressInfo> {
    if (this.articles.articles.size > 0) {
      try {
        this.#analyze();
      } catch (error) {
        this.#log.error("initial analysis failed", { error });
      }
    }
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(port, host, () => {
        this.server.off("error", reject);
        resolve();
      });
    });
    const address = this.server.address() as AddressInfo;
    this.#log.info("listening", {
      port: address.port, sources: this.#o.sourceList.sources.length, storage: this.#o.storage.kind,
      articles: this.articles.articles.size, x_enabled: Boolean(this.xStore),
    });
    void this.tick();
    this.#interval = setInterval(() => void this.tick(), this.#o.service.cycleIntervalMs);
    return address;
  }

  /** Runs one cycle unless one is already running (then returns "skipped"). */
  tick(): Promise<CycleResult> {
    if (this.#stopping) return Promise.resolve("skipped");
    if (this.#current) {
      this.#log.debug("cycle still running; skipping tick");
      return Promise.resolve("skipped");
    }
    const run = this.#runWithWatchdog().finally(() => {
      this.#current = undefined;
    });
    this.#current = run;
    return run;
  }

  /** Graceful shutdown: stop accepting work, let the running cycle finish (bounded), persist, close the database. */
  async stop(reason = "shutdown"): Promise<void> {
    if (this.#stopping) return;
    this.#stopping = true;
    this.#log.info("shutting down", { reason, cycle_running: Boolean(this.#current) });
    clearInterval(this.#interval);
    const closed = new Promise<void>((resolve) => this.server.close(() => resolve()));
    this.server.closeIdleConnections();

    if (this.#current) {
      const finished = await within(this.#current.then(() => true), this.#o.service.shutdownTimeoutMs, false);
      if (!finished) this.#log.warn("cycle did not finish before the shutdown timeout; saving current state");
    }
    this.#commit("shutdown");
    this.server.closeAllConnections();
    await within(closed, 2_000, undefined);
    try {
      this.#o.storage.close();
    } catch (error) {
      this.#log.error("closing storage failed", { error });
    }
    this.#log.info("stopped");
  }

  async #runWithWatchdog(): Promise<CycleResult> {
    const timeoutMs = this.#o.service.cycleTimeoutMs;
    const controller = new AbortController();
    const started = performance.now();
    let timedOut = false;
    const soft = setTimeout(() => {
      timedOut = true;
      controller.abort();
      this.#log.error("cycle exceeded timeout; skipping its remaining stages", { timeout_ms: timeoutMs });
    }, timeoutMs);
    const hard = setTimeout(() => {
      this.#log.error("cycle is stuck", { running_ms: Math.round(performance.now() - started) });
      this.#o.onStuck?.();
    }, timeoutMs * 2);
    soft.unref();
    hard.unref();

    let result: CycleResult;
    try {
      await this.#cycle(controller.signal);
      result = timedOut ? "timeout" : "ok";
    } catch (error) {
      this.#log.error("cycle failed", { error });
      result = timedOut ? "timeout" : "error";
    } finally {
      clearTimeout(soft);
      clearTimeout(hard);
    }
    const seconds = (performance.now() - started) / 1000;
    this.metrics.cycleDuration.observe(seconds);
    this.metrics.cycles.inc({ result });
    if (result === "ok") this.metrics.lastCycleSuccess.set(Math.floor(this.#now().getTime() / 1000));
    this.#log.info("cycle finished", { result, ms: Math.round(seconds * 1000) });
    return result;
  }

  async #cycle(signal: AbortSignal): Promise<void> {
    try {
      const report = await this.#collector.runCycle();
      const m = this.metrics;
      const ok = report.attempted - report.failed.length - report.notModified;
      m.sourceFetches.inc({ result: "ok" }, ok);
      m.sourceFetches.inc({ result: "not_modified" }, report.notModified);
      m.sourceFetches.inc({ result: "failed" }, report.failed.length);
      for (const f of report.failed) m.sourceFailures.inc({ source: f.sourceId });
      m.newArticles.inc({}, report.newArticles);
      m.expiredArticles.inc({}, report.expired);
      m.articles.set(this.articles.articles.size);
      m.sourcesUnhealthy.set([...this.articles.sourceState.values()].filter((s) => s.consecutiveFailures > 0).length);
      this.#log.info("sources collected", {
        attempted: report.attempted, new: report.newArticles, not_modified: report.notModified,
        failed: report.failed.length, expired: report.expired, articles: this.articles.articles.size,
      });
      for (const f of report.failed) this.#log.warn("source failed", { source: f.sourceId, error: f.error });

      const events = this.#analyze();

      if (this.#o.service.gdelt && !signal.aborted && !this.#stopping) {
        // Coverage for the newest multi-source events; GDELT allows about one request every 5 seconds.
        this.coverage.retain(new Set(events.map((e) => e.id)));
        const top = events.filter((e) => e.verification.confirming >= 2 || e.verification.signals > 0).slice(0, 5);
        const checked = await this.coverage.refresh(top, 5);
        if (checked > 0) {
          this.#publish(events);
          this.#log.info("gdelt coverage updated", { events: checked });
        }
      }

      if (this.#ingestor && !signal.aborted && !this.#stopping) {
        try {
          this.#log.info("x cycle", { report: await this.#ingestor.runCycle() });
        } catch (error) {
          this.#log.error("x cycle failed", { error });
        }
      }
    } finally {
      // Whatever happened, persist what we have: one transaction for the whole cycle.
      this.#commit("cycle");
      this.#cleanup();
    }
  }

  #analyze(): ReturnType<typeof analyze> {
    const started = performance.now();
    const all = [...this.articles.articles.values()];
    const events = analyze(all, this.#sourceMap);
    const now = this.#now();
    this.statusHistory.record(events, now);
    this.#publish(events);
    this.trackRecord.update(events, now);
    const seconds = (performance.now() - started) / 1000;
    this.metrics.analysisDuration.observe(seconds);

    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const e of events) byStatus[e.verification.status] = (byStatus[e.verification.status] ?? 0) + 1;
    this.metrics.events.replace(Object.entries(byStatus).map(([status, value]) => ({ labels: { status }, value })));
    this.#log.info("analysis", { articles: all.length, events: events.length, ms: Math.round(seconds * 1000), by_status: byStatus });
    return events;
  }

  #publish(events: ReturnType<typeof analyze>): void {
    this.latestEvents = toApiEvents(events, this.articles.articles, this.#sourceMap, this.#now(), (id) => this.coverage.get(id), (id) => this.statusHistory.get(id));
    this.metrics.ready.set(1);
  }

  #commit(when: string): void {
    const started = performance.now();
    try {
      const stats = this.#o.storage.commit({
        articles: this.articles.snapshot(),
        trackRecord: this.trackRecord.snapshot(),
        history: this.statusHistory.snapshot(),
        ...(this.xStore ? { x: this.xStore.snapshot() } : {}),
      });
      const seconds = (performance.now() - started) / 1000;
      this.metrics.storageCommitDuration.observe(seconds);
      this.#log.debug("state saved", { when, ...stats, ms: Math.round(seconds * 1000) });
    } catch (error) {
      this.metrics.storageErrors.inc();
      this.#log.error("saving state failed", { when, error });
    }
  }

  #cleanup(): void {
    const now = this.#now().getTime();
    if (now - this.#lastCleanup < CLEANUP_EVERY_MS) return;
    this.#lastCleanup = now;
    try {
      const removed = this.#o.storage.cleanup({ articlesFetchedBefore: new Date(now - this.#o.service.articleRetentionHours * 3_600_000) });
      this.#log.debug("storage cleanup", { removed });
    } catch (error) {
      this.metrics.storageErrors.inc();
      this.#log.error("storage cleanup failed", { error });
    }
  }

  #countingFetch(inner: typeof fetch): typeof fetch {
    return async (input, init) => {
      try {
        const response = await inner(input, init);
        this.metrics.gdeltCalls.inc({ result: response.ok ? "ok" : response.status === 429 ? "rate_limited" : "error" });
        return response;
      } catch (error) {
        this.metrics.gdeltCalls.inc({ result: "error" });
        throw error;
      }
    };
  }
}

/** Resolves with `promise`, or with `fallback` after `ms`. The timer keeps the process alive while waiting. */
async function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
