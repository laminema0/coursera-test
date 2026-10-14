import type { Article, NewsSource } from "../sources/types.ts";
import { originOf, type OriginKind } from "./origin.ts";
import { addInto, cosine, sharedTerms, similarity, type SparseVector, TfIdf, weightedTerms } from "./text.ts";

export interface ClusterOptions {
  /** Minimum cosine similarity to join an event. */
  threshold: number;
  /** Second pass: merge two events whose combined word profiles are at least this similar. */
  mergeThreshold: number;
  /** An article joins an event only if the event had activity within this window. */
  windowHours: number;
  /** Two articles this similar from different origins are treated as copies of one report. */
  copyThreshold: number;
}

export const defaultClusterOptions: ClusterOptions = { threshold: 0.3, mergeThreshold: 0.4, windowHours: 36, copyThreshold: 0.85 };

export interface EventOrigin {
  /** Origin key after merging copies (e.g. "wire:reuters", "outlet:bbc"). */
  key: string;
  kind: OriginKind;
  sourceIds: string[];
  articleIds: string[];
  /** Best (lowest) tier among its sources; "primary" and "signal" kept as-is. */
  tier: NewsSource["tier"];
}

export interface NewsEvent {
  /** Id of the earliest article: stable while the event exists. */
  id: string;
  title: string;
  articleIds: string[];
  firstSeenAt: string;
  lastUpdatedAt: string;
  keyTerms: string[];
  origins: EventOrigin[];
  /** Independent origins that can confirm (excludes "signal"). */
  independentCount: number;
}

interface Working {
  articles: Article[];
  vectors: SparseVector[];
  centroid: SparseVector;
  firstAt: number;
  lastAt: number;
}

/**
 * Groups articles into events (single pass, oldest first).
 * Each article joins the most similar recent event above `threshold`, or starts a new one.
 * Rebuilt from scratch each cycle: simple, deterministic, and fast enough for ~20k articles.
 */
export function clusterArticles(
  articles: Article[],
  sources: Map<string, NewsSource>,
  options: ClusterOptions = defaultClusterOptions,
): NewsEvent[] {
  const sorted = [...articles].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id));
  const termCounts = sorted.map((a) => weightedTerms(a.title, a.summary));
  const tfidf = new TfIdf();
  for (const counts of termCounts) tfidf.addDocument(counts.keys());

  const events: Working[] = [];
  const index = new Map<string, Set<number>>();
  const windowMs = options.windowHours * 3_600_000;
  // Only distinctive words find candidates: a word in most articles ("police") would make every event a candidate.
  const maxDf = Math.max(20, Math.floor(sorted.length * 0.02));
  const distinctive = (term: string) => tfidf.documentFrequency(term) <= maxDf;

  sorted.forEach((article, i) => {
    const vector = tfidf.vector(termCounts[i]!);
    if (vector.size === 0) return;
    const at = Date.parse(article.publishedAt);

    const candidates = new Set<number>();
    for (const term of vector.keys()) {
      if (!distinctive(term)) continue;
      for (const e of index.get(term) ?? []) if (at - events[e]!.lastAt <= windowMs) candidates.add(e);
    }

    let best = -1;
    let bestScore = 0;
    for (const e of candidates) {
      const event = events[e]!;
      if (at - event.lastAt > windowMs) continue;
      // One shared word ("earthquake") is not enough to be the same incident.
      if (sharedTerms(vector, event.centroid) < Math.min(2, vector.size)) continue;
      const score = similarity(vector, event.centroid);
      if (score > bestScore) {
        best = e;
        bestScore = score;
      }
    }

    if (best >= 0 && bestScore >= options.threshold) {
      const event = events[best]!;
      event.articles.push(article);
      event.vectors.push(vector);
      addInto(event.centroid, vector);
      event.lastAt = Math.max(event.lastAt, at);
      for (const term of vector.keys()) if (distinctive(term)) addToIndex(index, term, best);
    } else {
      const e = events.push({ articles: [article], vectors: [vector], centroid: new Map(vector), firstAt: at, lastAt: at }) - 1;
      for (const term of vector.keys()) if (distinctive(term)) addToIndex(index, term, e);
    }
  });

  return mergeSimilar(events, options, distinctive).map((event) => finalize(event, sources, options));
}

/**
 * Single-pass grouping depends on arrival order: early, differently-worded reports can start separate events.
 * A second pass merges events whose combined profiles are similar. Candidates come from an index of each
 * event's most distinctive words, so this stays fast with tens of thousands of articles.
 */
function mergeSimilar(events: Working[], options: ClusterOptions, distinctive: (term: string) => boolean): Working[] {
  const windowMs = options.windowHours * 3_600_000;
  let alive = [...events].sort((a, b) => a.firstAt - b.firstAt);

  for (let round = 0; round < 3; round += 1) {
    const index = new Map<string, Set<number>>();
    alive.forEach((event, i) => {
      for (const term of topTerms(event.centroid, 10)) if (distinctive(term)) addToIndex(index, term, i);
    });

    const dead = new Set<number>();
    let merges = 0;
    alive.forEach((event, i) => {
      if (dead.has(i)) return;
      const candidates = new Set<number>();
      for (const term of topTerms(event.centroid, 10)) {
        for (const j of index.get(term) ?? []) if (j > i && !dead.has(j)) candidates.add(j);
      }
      for (const j of [...candidates].sort((a, b) => a - b)) {
        const other = alive[j]!;
        if (other.firstAt - event.lastAt > windowMs || event.firstAt - other.lastAt > windowMs) continue;
        if (sharedTerms(event.centroid, other.centroid) < 2) continue;
        if (similarity(event.centroid, other.centroid) < options.mergeThreshold) continue;
        absorb(event, other);
        dead.add(j);
        merges += 1;
      }
    });
    alive = alive.filter((_, i) => !dead.has(i));
    if (merges === 0) break;
  }
  return alive;
}

function absorb(target: Working, other: Working): void {
  const order = target.articles.map((article, k) => [article, target.vectors[k]!] as const)
    .concat(other.articles.map((article, k) => [article, other.vectors[k]!] as const))
    .sort((x, y) => x[0].publishedAt.localeCompare(y[0].publishedAt) || x[0].id.localeCompare(y[0].id));
  target.articles = order.map(([article]) => article);
  target.vectors = order.map(([, vector]) => vector);
  addInto(target.centroid, other.centroid);
  target.firstAt = Math.min(target.firstAt, other.firstAt);
  target.lastAt = Math.max(target.lastAt, other.lastAt);
}

function topTerms(v: SparseVector, n: number): string[] {
  return [...v.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
}

function addToIndex(index: Map<string, Set<number>>, term: string, event: number): void {
  let set = index.get(term);
  if (!set) index.set(term, (set = new Set()));
  set.add(event);
}

function finalize(event: Working, sources: Map<string, NewsSource>, options: ClusterOptions): NewsEvent {
  const { articles, vectors, centroid } = event;

  // Origins, then merge origins whose articles are near-identical copies of each other.
  const originOfArticle = articles.map((a) => {
    const source = sources.get(a.sourceIds[0] ?? "");
    return source ? originOf(a, source) : { key: `unknown:${a.sourceIds[0]}`, kind: "outlet" as const };
  });
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    const p = parent.get(k) ?? k;
    if (p === k) return k;
    const root = find(p);
    parent.set(k, root);
    return root;
  };
  for (let i = 0; i < articles.length; i += 1) {
    for (let j = i + 1; j < articles.length; j += 1) {
      const a = originOfArticle[i]!;
      const b = originOfArticle[j]!;
      if (a.key === b.key || a.kind === "primary" || b.kind === "primary") continue;
      if (cosine(vectors[i]!, vectors[j]!) >= options.copyThreshold) {
        // Keep the earlier article's origin as the root: the later one copied it.
        const [ra, rb] = [find(a.key), find(b.key)];
        if (ra !== rb) parent.set(rb, ra);
      }
    }
  }

  const origins = new Map<string, EventOrigin>();
  articles.forEach((article, i) => {
    const own = originOfArticle[i]!;
    const key = find(own.key);
    const kind = key === own.key ? own.kind : originKindOf(key);
    let origin = origins.get(key);
    if (!origin) {
      origin = { key, kind, sourceIds: [], articleIds: [], tier: "signal" };
      origins.set(key, origin);
    }
    origin.articleIds.push(article.id);
    for (const sourceId of article.sourceIds) {
      if (!origin.sourceIds.includes(sourceId)) origin.sourceIds.push(sourceId);
      const tier = sources.get(sourceId)?.tier;
      if (tier !== undefined) origin.tier = betterTier(origin.tier, tier);
    }
  });

  // Headline: the article closest to the event's centre, preferring tier-1 and official sources.
  let titleIndex = 0;
  let titleScore = -1;
  articles.forEach((article, i) => {
    const tier = sources.get(article.sourceIds[0] ?? "")?.tier;
    const bonus = tier === 1 || tier === "primary" ? 0.1 : tier === "signal" ? -0.2 : 0;
    const score = cosine(vectors[i]!, centroid) + bonus;
    if (score > titleScore) {
      titleIndex = i;
      titleScore = score;
    }
  });

  const times = articles.map((a) => a.publishedAt).sort();
  // Wire agencies (Reuters, AP, AFP…) have strong editorial standards, whoever republishes their story.
  for (const origin of origins.values()) if (origin.kind === "wire") origin.tier = 1;
  const originList = [...origins.values()];
  return {
    id: articles[0]!.id,
    title: articles[titleIndex]!.title,
    articleIds: articles.map((a) => a.id),
    firstSeenAt: times[0]!,
    lastUpdatedAt: times.at(-1)!,
    keyTerms: [...centroid.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t),
    origins: originList,
    independentCount: originList.filter((o) => o.kind !== "signal").length,
  };
}

function originKindOf(key: string): OriginKind {
  const prefix = key.split(":")[0];
  return prefix === "wire" ? "wire" : prefix === "primary" ? "primary" : prefix === "signal" ? "signal" : "outlet";
}

const TIER_RANK: Record<string, number> = { primary: 0, "1": 1, "2": 2, signal: 3 };
function betterTier(a: NewsSource["tier"], b: NewsSource["tier"]): NewsSource["tier"] {
  return (TIER_RANK[String(b)] ?? 9) < (TIER_RANK[String(a)] ?? 9) ? b : a;
}
