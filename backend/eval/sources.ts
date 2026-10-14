import { readFileSync } from "node:fs";
import type { NewsSource, SourceList } from "../src/sources/types.ts";

// The real English source list, plus a few outlets the benchmark needs that aren't (yet) in it:
// more state media (to test the own-country rule) and local outlets that break stories first.
const extra = (id: string, tier: NewsSource["tier"], owner: string, country: string, stateFunded = false): NewsSource => ({
  id, name: id, url: `https://${id}.eval/feed`, format: "rss", tier, owner, country, pollMinutes: 10, ...(stateFunded ? { stateFunded } : {}),
});

const EXTRA: NewsSource[] = [
  extra("xinhua", 2, "xinhua", "CN", true),
  extra("cgtn", 2, "cmg", "CN", true),
  extra("tass", 2, "tass", "RU", true),
  extra("rt", 2, "rt", "RU", true),
  extra("presstv", 2, "irib", "IR", true),
  extra("nhk-world", 1, "nhk", "JP"),
  extra("nation-ke", 2, "nation-media", "KE"),
  extra("inquirer-ph", 2, "inquirer", "PH"),
  extra("dhakatribune", 2, "dhakatribune", "BD"),
  extra("kxan", 2, "nexstar", "US"),
  extra("wsb-atlanta", 2, "cox", "US"),
  extra("rappler", 2, "rappler", "PH"),
];

export function loadSources(): Map<string, NewsSource> {
  const url = new URL("../sources/en.json", import.meta.url);
  const list = JSON.parse(readFileSync(url, "utf8")) as SourceList;
  return new Map([...list.sources, ...EXTRA].map((s) => [s.id, s]));
}
