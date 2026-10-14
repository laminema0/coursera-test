import type { Article, NewsSource } from "../sources/types.ts";
import { originOf, type OriginKind } from "./origin.ts";
import { addInto, disjoint, frozenNormSq, incidentTypes, nameTerms, overlapOf, pairContainment, type SparseVector, TfIdf, tokenize, weightedTerms } from "./text.ts";

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
  /** Squared norm of the centroid, kept up to date as articles join (recomputing it is the hot spot). */
  centroidNormSq: number;
  /** Incident kinds named in its headlines ("quake", "sinking"…). */
  types: Set<string>;
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
  const typesOf = sorted.map((a) => incidentTypes(tokenize(a.title)));
  const tfidf = new TfIdf();
  for (const counts of termCounts) tfidf.addDocument(counts.keys());

  const events: Working[] = [];
  const index = new Map<string, Set<number>>();
  const windowMs = options.windowHours * 3_600_000;
  // Only distinctive words find candidates: a word in most articles ("police") would make every event a candidate.
  const maxDf = Math.max(20, Math.floor(sorted.length * 0.02));
  const distinctive = (term: string) => tfidf.documentFrequency(term) <= maxDf;

  sorted.forEach((article, i) => {
    const vector = articleVector(tfidf, termCounts[i]!, article);
    if (vector.size === 0) return;
    const at = Date.parse(article.publishedAt);

    // Candidates share distinctive words; only the ones sharing the most (by rarity) are scored in full.
    const overlap = new Map<number, number>();
    for (const [term, weight] of vector) {
      if (!distinctive(term)) continue;
      const posting = index.get(term);
      if (!posting) continue;
      for (const e of posting) {
        // Articles arrive in time order, so an event outside the window never becomes a candidate again.
        if (at - events[e]!.lastAt > windowMs) posting.delete(e);
        else overlap.set(e, (overlap.get(e) ?? 0) + weight);
      }
    }
    const candidates = topKeys(overlap, MAX_CANDIDATES);

    let best = -1;
    let bestScore = 0;
    for (const e of candidates) {
      const event = events[e]!;
      if (at - event.lastAt > windowMs) continue;
      // Same place, different incident: "Ferry capsizes off Sulawesi" doesn't join the Sulawesi earthquake.
      if (disjoint(typesOf[i]!, event.types)) continue;
      // One shared word ("earthquake") is not enough to be the same incident.
      const { dot, shared } = overlapOf(vector, event.centroid);
      if (shared < Math.min(2, vector.size)) continue;
      const score = eventSimilarity(vector, dot, event);
      if (score > bestScore) {
        best = e;
        bestScore = score;
      }
    }

    if (best >= 0 && bestScore >= options.threshold) {
      const event = events[best]!;
      event.articles.push(article);
      event.vectors.push(vector);
      grow(event, vector);
      event.lastAt = Math.max(event.lastAt, at);
      for (const type of typesOf[i]!) event.types.add(type);
      for (const term of vector.keys()) if (distinctive(term)) addToIndex(index, term, best);
    } else {
      const e = events.push({ articles: [article], vectors: [vector], centroid: new Map(vector), centroidNormSq: frozenNormSq(vector), types: new Set(typesOf[i]), firstAt: at, lastAt: at }) - 1;
      for (const term of vector.keys()) if (distinctive(term)) addToIndex(index, term, e);
    }
  });

  const countsById = new Map(sorted.map((a, i) => [a.id, termCounts[i]!]));
  const plain = (a: Article) => tfidf.vector(countsById.get(a.id)!);
  return mergeSimilar(events, options, distinctive).map((event) => finalize(event, sources, options, plain));
}

/**
 * Builds events from a known grouping (lists of article ids) instead of clustering.
 * Used by the quality benchmark to score statuses and numbers independently of grouping mistakes.
 */
export function eventsFromGroups(
  articles: Article[],
  groups: string[][],
  sources: Map<string, NewsSource>,
  options: ClusterOptions = defaultClusterOptions,
): NewsEvent[] {
  const termCounts = new Map(articles.map((a) => [a.id, weightedTerms(a.title, a.summary)]));
  const tfidf = new TfIdf();
  for (const counts of termCounts.values()) tfidf.addDocument(counts.keys());
  const byId = new Map(articles.map((a) => [a.id, a]));
  return groups.map((ids) => {
    const members = ids.map((id) => byId.get(id)!).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id));
    const vectors = members.map((a) => articleVector(tfidf, termCounts.get(a.id)!, a));
    const centroid: SparseVector = new Map();
    for (const v of vectors) addInto(centroid, v);
    let centroidNormSq = 0;
    for (const w of centroid.values()) centroidNormSq += w * w;
    const times = members.map((a) => Date.parse(a.publishedAt));
    const types = incidentTypes(members.flatMap((a) => tokenize(a.title)));
    const plain = (a: Article) => tfidf.vector(termCounts.get(a.id)!);
    return finalize({ articles: members, vectors, centroid, centroidNormSq, types, firstAt: Math.min(...times), lastAt: Math.max(...times) }, sources, options, plain);
  });
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
    const tops = alive.map((event) => topTerms(event.centroid, 10).filter(distinctive));
    tops.forEach((terms, i) => {
      for (const term of terms) addToIndex(index, term, i);
    });

    const dead = new Set<number>();
    let merges = 0;
    alive.forEach((event, i) => {
      if (dead.has(i)) return;
      const overlap = new Map<number, number>();
      for (const term of tops[i]!) {
        for (const j of index.get(term) ?? []) if (j > i && !dead.has(j)) overlap.set(j, (overlap.get(j) ?? 0) + 1);
      }
      for (const j of topKeys(overlap, MAX_CANDIDATES)) {
        const other = alive[j]!;
        if (other.firstAt - event.lastAt > windowMs || event.firstAt - other.lastAt > windowMs) continue;
        if (disjoint(event.types, other.types)) continue;
        const { dot, shared } = overlapOf(event.centroid, other.centroid);
        if (shared < 2) continue;
        if (mergeSimilarity(event, other, dot, options.mergeThreshold) < options.mergeThreshold) continue;
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
  grow(target, other.centroid);
  for (const type of other.types) target.types.add(type);
  target.firstAt = Math.min(target.firstAt, other.firstAt);
  target.lastAt = Math.max(target.lastAt, other.lastAt);
}

/** Names weigh more than common words of the same rarity (see `nameTerms`). */
const NAME_BOOST = 1.5;

function articleVector(tfidf: TfIdf, counts: Map<string, number>, article: Article): SparseVector {
  const vector = tfidf.vector(counts);
  for (const term of nameTerms(article.title, article.summary)) {
    const weight = vector.get(term);
    if (weight !== undefined) vector.set(term, weight * NAME_BOOST);
  }
  return vector;
}

/** Events scored in full per article (or per event in the merge pass). Keeps big, busy news days fast. */
const MAX_CANDIDATES = 25;

function frozenCosine(a: SparseVector, b: SparseVector): number {
  const d = overlapOf(a, b).dot;
  return d === 0 ? 0 : d / Math.sqrt(frozenNormSq(a) * frozenNormSq(b));
}

function topKeys(scores: Map<number, number>, n: number): number[] {
  const entries = [...scores.entries()];
  if (entries.length > n) entries.sort((a, b) => b[1] - a[1] || a[0] - b[0]).length = n;
  return entries.map(([key]) => key).sort((a, b) => a - b);
}

/** How many recent member articles to compare with: keeps scoring cost flat for big events. */
const RECENT_MEMBERS = 10;

/**
 * Cosine with the event's word profile, or (discounted) containment of the shorter text in one of its articles.
 * Containment is fair to short texts (social posts, terse headlines), but measured against the whole centroid it
 * drifts toward 1 as the event grows (a big event contains every common word) and events snowball. Measured
 * against single articles it stays a real "this text is about the same thing" test.
 */
function eventSimilarity(vector: SparseVector, dotWithCentroid: number, event: Working): number {
  let best = dotWithCentroid / Math.sqrt(frozenNormSq(vector) * event.centroidNormSq);
  const members = event.vectors;
  for (let k = Math.max(0, members.length - RECENT_MEMBERS); k < members.length; k += 1) {
    best = Math.max(best, 0.6 * pairContainment(vector, members[k]!));
  }
  return best;
}

/** Like `eventSimilarity`, between two events; stops as soon as `enough` is reached. */
function mergeSimilarity(a: Working, b: Working, dotOfCentroids: number, enough: number): number {
  let best = dotOfCentroids / Math.sqrt(a.centroidNormSq * b.centroidNormSq);
  if (best >= enough) return best;
  const xs = a.vectors.slice(-RECENT_MEMBERS / 2);
  const ys = b.vectors.slice(-RECENT_MEMBERS / 2);
  for (const x of xs) {
    for (const y of ys) {
      best = Math.max(best, 0.6 * pairContainment(x, y));
      if (best >= enough) return best;
    }
  }
  return best;
}

/** Adds a vector to the event's centroid, keeping its squared norm current. */
function grow(event: Working, v: SparseVector): void {
  for (const [term, weight] of v) {
    const old = event.centroid.get(term) ?? 0;
    const updated = old + weight;
    event.centroid.set(term, updated);
    event.centroidNormSq += updated * updated - old * old;
  }
}

function topTerms(v: SparseVector, n: number): string[] {
  return [...v.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
}

function addToIndex(index: Map<string, Set<number>>, term: string, event: number): void {
  let set = index.get(term);
  if (!set) index.set(term, (set = new Set()));
  set.add(event);
}

/** `plain` gives an article's vector without the name boost: copies are judged on the text alone. */
function finalize(event: Working, sources: Map<string, NewsSource>, options: ClusterOptions, plain: (a: Article) => SparseVector): NewsEvent {
  const { articles, vectors, centroid } = event;
  const plainVectors = articles.length > 1 ? articles.map(plain) : [];

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
      if (frozenCosine(plainVectors[i]!, plainVectors[j]!) >= options.copyThreshold) {
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
    const score = overlapOf(vectors[i]!, centroid).dot / Math.sqrt(frozenNormSq(vectors[i]!) * event.centroidNormSq) + bonus;
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
