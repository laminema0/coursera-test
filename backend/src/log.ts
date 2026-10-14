// Structured JSON logs, one object per line, so journald / docker logs can be filtered with jq.

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  /** Same sink and level, with `fields` added to every line. */
  child(fields: LogFields): Logger;
  enabled(level: LogLevel): boolean;
}

export function parseLogLevel(value: string | undefined, fallback: LogLevel = "info"): LogLevel {
  const v = value?.trim().toLowerCase();
  return v && v in RANK ? (v as LogLevel) : fallback;
}

export function createLogger(options: {
  level?: LogLevel;
  /** Receives one serialized line. Defaults to stdout (errors to stderr). */
  write?: (line: string, level: LogLevel) => void;
  now?: () => Date;
  fields?: LogFields;
} = {}): Logger {
  const min = RANK[options.level ?? "info"];
  const now = options.now ?? (() => new Date());
  const write = options.write ?? ((line, level) => (level === "error" ? process.stderr : process.stdout).write(`${line}\n`));
  const base = options.fields ?? {};

  const emit = (level: LogLevel, msg: string, fields?: LogFields) => {
    if (RANK[level] < min) return;
    const entry: LogFields = { ts: now().toISOString(), level, msg, ...base };
    for (const [k, v] of Object.entries(fields ?? {})) entry[k] = v instanceof Error ? errorFields(v) : v;
    let line: string;
    try {
      line = JSON.stringify(entry);
    } catch {
      line = JSON.stringify({ ts: entry.ts, level, msg, note: "fields not serializable" });
    }
    write(line, level);
  };

  return {
    debug: (msg, fields) => emit("debug", msg, fields),
    info: (msg, fields) => emit("info", msg, fields),
    warn: (msg, fields) => emit("warn", msg, fields),
    error: (msg, fields) => emit("error", msg, fields),
    child: (fields) => createLogger({ ...options, fields: { ...base, ...fields } }),
    enabled: (level) => RANK[level] >= min,
  };
}

/** Discards everything; handy in tests. */
export const silentLogger: Logger = createLogger({ level: "error", write: () => {} });

function errorFields(error: Error): LogFields {
  return { name: error.name, message: error.message, stack: error.stack?.split("\n").slice(0, 6).join("\n") };
}
