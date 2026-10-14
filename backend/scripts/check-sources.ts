// Checks every source in a source list: reachable? parses? how fresh?
// Usage: npm run check-sources [-- sources/en.json]
import { readFileSync } from "node:fs";
import { parseSource } from "../src/sources/parse.ts";
import type { NewsSource, SourceList } from "../src/sources/types.ts";

const file = process.argv[2] ?? "sources/en.json";
const list = JSON.parse(readFileSync(file, "utf8")) as SourceList;

async function check(source: NewsSource): Promise<string> {
  try {
    const response = await fetch(source.url, {
      headers: { "User-Agent": "NewsVerify/0.1 (independent non-commercial project; RSS reader)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return `❌ ${source.id.padEnd(22)} HTTP ${response.status}`;
    const body = await response.text();
    const entries = parseSource(source, body);
    if (entries.length === 0) return `⚠️  ${source.id.padEnd(22)} reachable, but no entries parsed`;
    const newest = entries.map((e) => e.publishedAt).filter(Boolean).sort().at(-1);
    const age = newest ? `${Math.round((Date.now() - Date.parse(newest)) / 60_000)} min old` : "no dates";
    return `✅ ${source.id.padEnd(22)} ${String(entries.length).padStart(3)} items, newest ${age}`;
  } catch (error) {
    return `❌ ${source.id.padEnd(22)} ${error instanceof Error ? error.message : String(error)}`;
  }
}

const results: string[] = [];
const queue = [...list.sources];
await Promise.all(Array.from({ length: 8 }, async () => {
  for (let s = queue.shift(); s; s = queue.shift()) results.push(await check(s));
}));
results.sort().forEach((line) => console.log(line));
const ok = results.filter((r) => r.startsWith("✅")).length;
console.log(`\n${ok}/${list.sources.length} sources OK`);
