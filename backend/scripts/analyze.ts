// Collects once from all free sources (or reuses ./data/articles.json) and prints verified events.
// Usage: npm run analyze            (top 25)
//        npm run analyze -- 50      (top 50)
import { existsSync, readFileSync } from "node:fs";
import { analyze, type VerifiedEvent } from "../src/analysis/verify.ts";
import { ArticleStore, type ArticleSnapshot } from "../src/sources/article-store.ts";
import { Collector } from "../src/sources/collector.ts";
import type { SourceList } from "../src/sources/types.ts";

const limit = Number(process.argv[2] ?? 25);
const list = JSON.parse(readFileSync(process.env.SOURCES_FILE ?? "sources/en.json", "utf8")) as SourceList;
const sources = new Map(list.sources.map((s) => [s.id, s]));
const snapshotFile = "data/articles.json";

let store: ArticleStore;
if (existsSync(snapshotFile)) {
  store = ArticleStore.restore(JSON.parse(readFileSync(snapshotFile, "utf8")) as ArticleSnapshot);
  console.log(`Using ${snapshotFile} (${store.articles.size} articles). Delete it to collect fresh.`);
} else {
  store = new ArticleStore();
  console.log(`Collecting from ${list.sources.length} sources…`);
  const report = await new Collector({ sources: list.sources, language: list.language, store }).runCycle();
  console.log(`${report.newArticles} articles, ${report.failed.length} sources failed.`);
}

const started = Date.now();
const events = analyze([...store.articles.values()], sources);
const multi = events.filter((e) => e.articleIds.length > 1);
console.log(`${store.articles.size} articles → ${events.length} events (${multi.length} with 2+ articles) in ${Date.now() - started} ms\n`);

const ICON: Record<string, string> = { unverified: "⚪", reported: "🟡", corroborated: "🟢", confirmed: "✅", disputed: "🔴", retracted: "⚫" };
const ranked = [...multi].sort((a, b) => b.verification.confirming - a.verification.confirming || b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));

for (const event of ranked.slice(0, limit)) print(event);

function print(e: VerifiedEvent): void {
  const v = e.verification;
  console.log(`${ICON[v.status]} ${e.title}`);
  console.log(`   ${v.status.toUpperCase()} · ${v.reason}`);
  for (const n of e.numbers) {
    const range = n.min === n.max ? `${n.min}` : `${n.min}–${n.max}`;
    const official = n.latestOfficial ? ` · latest official ${n.latestOfficial.value}` : "";
    console.log(`   ${n.kind}: ${range} · most reported ${n.mostReported.value} (${n.mostReported.origins} src)${official}`);
  }
  for (const s of e.statements.slice(0, 3)) console.log(`   "${s.speaker}": says ×${s.asserts}, denies ×${s.denies}, confirms ×${s.confirms}`);
  console.log(`   sources: ${e.origins.map((o) => `${o.key}(${o.sourceIds.join(",")})`).join("  ")}\n`);
}
