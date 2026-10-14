// Minimal Prometheus text-format registry (exposition format 0.0.4). No dependency needed for a handful of series.

type Labels = Record<string, string>;

interface Series {
  name: string;
  help: string;
  type: "counter" | "gauge" | "histogram";
  render(): string[];
}

const keyOf = (labels: Labels) => JSON.stringify(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)));

function formatLabels(labels: Labels): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";
  const escape = (v: string) => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
  return `{${entries.map(([k, v]) => `${k}="${escape(v)}"`).join(",")}}`;
}

const formatNumber = (n: number) => (Number.isFinite(n) ? String(n) : n > 0 ? "+Inf" : n < 0 ? "-Inf" : "NaN");

export class Counter implements Series {
  readonly type = "counter";
  readonly #values = new Map<string, { labels: Labels; value: number }>();
  readonly name: string;
  readonly help: string;
  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  inc(labels: Labels = {}, by = 1): void {
    const key = keyOf(labels);
    const entry = this.#values.get(key) ?? { labels, value: 0 };
    entry.value += by;
    this.#values.set(key, entry);
  }

  get(labels: Labels = {}): number {
    return this.#values.get(keyOf(labels))?.value ?? 0;
  }

  render(): string[] {
    return [...this.#values.values()].map((e) => `${this.name}${formatLabels(e.labels)} ${formatNumber(e.value)}`);
  }
}

export class Gauge implements Series {
  readonly type = "gauge";
  #values = new Map<string, { labels: Labels; value: number }>();
  readonly name: string;
  readonly help: string;
  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  set(value: number, labels: Labels = {}): void {
    this.#values.set(keyOf(labels), { labels, value });
  }

  /** Replaces all label sets at once (e.g. events by status), so stale ones disappear. */
  replace(entries: { labels: Labels; value: number }[]): void {
    this.#values = new Map(entries.map((e) => [keyOf(e.labels), e]));
  }

  get(labels: Labels = {}): number | undefined {
    return this.#values.get(keyOf(labels))?.value;
  }

  render(): string[] {
    return [...this.#values.values()].map((e) => `${this.name}${formatLabels(e.labels)} ${formatNumber(e.value)}`);
  }
}

export class Histogram implements Series {
  readonly type = "histogram";
  readonly #buckets: number[];
  readonly #values = new Map<string, { labels: Labels; counts: number[]; sum: number; count: number }>();
  readonly name: string;
  readonly help: string;
  constructor(name: string, help: string, buckets: number[]) {
    this.name = name;
    this.help = help;
    this.#buckets = [...buckets].sort((a, b) => a - b);
  }

  observe(value: number, labels: Labels = {}): void {
    const key = keyOf(labels);
    const entry = this.#values.get(key) ?? { labels, counts: this.#buckets.map(() => 0), sum: 0, count: 0 };
    this.#buckets.forEach((b, i) => {
      if (value <= b) entry.counts[i]! += 1;
    });
    entry.sum += value;
    entry.count += 1;
    this.#values.set(key, entry);
  }

  count(labels: Labels = {}): number {
    return this.#values.get(keyOf(labels))?.count ?? 0;
  }

  render(): string[] {
    const lines: string[] = [];
    for (const e of this.#values.values()) {
      this.#buckets.forEach((b, i) => lines.push(`${this.name}_bucket${formatLabels({ ...e.labels, le: String(b) })} ${e.counts[i]}`));
      lines.push(`${this.name}_bucket${formatLabels({ ...e.labels, le: "+Inf" })} ${e.count}`);
      lines.push(`${this.name}_sum${formatLabels(e.labels)} ${formatNumber(e.sum)}`);
      lines.push(`${this.name}_count${formatLabels(e.labels)} ${e.count}`);
    }
    return lines;
  }
}

export class Registry {
  readonly #series: Series[] = [];

  register<T extends Series>(series: T): T {
    this.#series.push(series);
    return series;
  }

  render(): string {
    const out: string[] = [];
    for (const s of this.#series) {
      out.push(`# HELP ${s.name} ${s.help}`, `# TYPE ${s.name} ${s.type}`, ...s.render());
    }
    return `${out.join("\n")}\n`;
  }
}

/** All series this service exports. One instance per process (tests create their own). */
export function createMetrics() {
  const registry = new Registry();
  const counter = (name: string, help: string) => registry.register(new Counter(name, help));
  const gauge = (name: string, help: string) => registry.register(new Gauge(name, help));
  const histogram = (name: string, help: string, buckets: number[]) => registry.register(new Histogram(name, help, buckets));

  return {
    registry,
    cycleDuration: histogram("newsverify_cycle_duration_seconds", "Duration of a full collection + analysis cycle.", [1, 5, 10, 30, 60, 120, 300, 600]),
    cycles: counter("newsverify_cycles_total", "Collection cycles by result (ok, error, timeout)."),
    lastCycleSuccess: gauge("newsverify_last_cycle_success_timestamp_seconds", "Unix time the last cycle finished without error."),
    analysisDuration: histogram("newsverify_analysis_duration_seconds", "Duration of event grouping + verification.", [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]),
    articles: gauge("newsverify_articles", "Articles currently held (within retention)."),
    newArticles: counter("newsverify_articles_new_total", "New articles collected."),
    expiredArticles: counter("newsverify_articles_expired_total", "Articles dropped by retention."),
    events: gauge("newsverify_events", "Events in the latest analysis, by verification status."),
    sourceFetches: counter("newsverify_source_fetches_total", "Feed fetch attempts by result (ok, not_modified, failed)."),
    sourceFailures: counter("newsverify_source_failures_total", "Failed feed fetches, by source."),
    sourcesUnhealthy: gauge("newsverify_sources_unhealthy", "Sources whose last fetch failed."),
    gdeltCalls: counter("newsverify_gdelt_requests_total", "GDELT DOC API requests by result (ok, error)."),
    storageCommitDuration: histogram("newsverify_storage_commit_seconds", "Duration of the per-cycle storage transaction.", [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]),
    storageErrors: counter("newsverify_storage_errors_total", "Failed storage transactions."),
    httpRequests: counter("newsverify_http_requests_total", "HTTP requests by route and status code."),
    httpDuration: histogram("newsverify_http_request_duration_seconds", "HTTP request duration by route.", [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]),
    httpRateLimited: counter("newsverify_http_rate_limited_total", "Requests rejected with 429."),
    ready: gauge("newsverify_ready", "1 once an analysis result is being served."),
    startTime: gauge("newsverify_process_start_time_seconds", "Unix time the process started."),
  };
}

export type Metrics = ReturnType<typeof createMetrics>;
