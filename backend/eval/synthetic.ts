import type { Article, NewsSource } from "../src/sources/types.ts";

// Synthetic load for the performance check: ~72 hours of feeds, made of many small events and lots of one-off
// stories, with realistic headline shapes. Deterministic (seeded) so timings are comparable between runs.

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SYLLABLES = ["ka", "lo", "mar", "ten", "vi", "sa", "dor", "bel", "ri", "an", "go", "su", "pra", "ner", "ti", "ul", "chen", "wa", "ba", "zor"];
const TYPES = [
  ["earthquake", "quake", "tremor"], ["flood", "floods", "flash flooding"], ["shooting", "gunfire", "gunman"], ["explosion", "blast"],
  ["fire", "blaze", "wildfire"], ["storm", "cyclone", "typhoon"], ["train crash", "derailment"], ["bus crash", "bus accident"],
  ["landslide", "mudslide"], ["building collapse", "collapse"], ["protest", "protests", "demonstration"], ["election", "vote", "polls"],
  ["strike", "walkout"], ["ferry sinking", "boat capsizes"], ["stabbing", "knife attack"],
];
const OUTCOMES = ["kills", "leaves dead", "injures", "displaces", "forces evacuations in", "hits", "rocks", "strikes"];
// One-off stories: subject + verb + object gives thousands of different everyday headlines.
const SUBJECTS = ["central bank", "court", "ministry", "football club", "carmaker", "museum", "startup", "union", "airline", "university",
  "regulator", "senate", "parliament", "festival", "hospital", "school board", "tech giant", "retailer", "port authority", "orchestra"];
const VERBS = ["announces", "delays", "approves", "rejects", "unveils", "cancels", "wins", "loses", "opens", "closes", "fines", "hires",
  "sells", "buys", "launches", "suspends", "reviews", "extends", "celebrates", "postpones"];
const OBJECTS = ["plan", "deal", "merger", "budget", "project", "final", "tariff", "licence", "contract", "report", "exhibition", "season",
  "satellite", "app", "bond sale", "pay rise", "stadium", "festival", "rail link", "reform"];

export function syntheticCorpus(total: number, sources: NewsSource[], seed = 42): Article[] {
  const random = rng(seed);
  const pick = <T>(list: T[]): T => list[Math.floor(random() * list.length)]!;
  const place = () => {
    const n = 2 + Math.floor(random() * 2);
    const name = Array.from({ length: n }, () => pick(SYLLABLES)).join("");
    return name[0]!.toUpperCase() + name.slice(1);
  };
  // Pseudo-words: a vocabulary of ~8,000 rare terms (names, topics) shared only by chance.
  const word = () => Array.from({ length: 3 }, () => pick(SYLLABLES)).join("");
  const feeds = sources.filter((s) => s.tier !== "primary");
  const start = Date.parse("2026-10-11T00:00:00Z");
  const spanMs = 72 * 3_600_000;
  const articles: Article[] = [];
  const add = (title: string, summary: string, at: number) => {
    const i = articles.length;
    const iso = new Date(at).toISOString();
    articles.push({ id: `syn-${i}`, url: `https://syn.test/${i}`, title, summary, publishedAt: iso, fetchedAt: iso, language: "en", sourceIds: [pick(feeds).id] });
  };

  while (articles.length < total) {
    if (random() < 0.4) {
      // One-off story: each has its own rare words, like real headlines about different things.
      const story = `${pick(SUBJECTS)} ${pick(VERBS)} ${pick(OBJECTS)}`;
      add(`${place()} ${story} ${word()}`, `${place()} ${word()} said the ${story} was expected on ${pick(["Monday", "Tuesday", "Wednesday"])}.`, start + random() * spanMs);
      continue;
    }
    // A small developing event: 2–12 articles over a few hours, sharing the event's own names.
    const where = place();
    const region = place();
    const names = [word(), word(), word()];
    const type = pick(TYPES);
    const at = start + random() * spanMs;
    const size = 2 + Math.floor(random() * 11);
    for (let k = 0; k < size && articles.length < total; k += 1) {
      const n = 1 + Math.floor(random() * 60);
      const name = pick(names);
      add(
        `${pick(type)} ${pick(OUTCOMES)} ${n} in ${where}, ${region} ${random() < 0.5 ? name : ""}`.trim(),
        `At least ${n} people were killed after the ${pick(type)} near ${pick(names)} in ${where}, ${pick(["police", "officials", "witnesses", "local media"])} said.`,
        at + random() * 6 * 3_600_000,
      );
    }
  }
  return articles;
}
