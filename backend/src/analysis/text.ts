// Small, dependency-free English text helpers for matching articles about the same event.

const STOP_WORDS = new Set(
  (
    "a about above after again against all am amid an and any are as at be because been before being below between both but by " +
    "can could did do does doing down during each few for from further had has have having he her here hers herself him himself his " +
    "how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out " +
    "over own same she should so some such than that the their theirs them themselves then there these they this those through to too " +
    "under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves " +
    "also says said say told tells new news latest live update updates report reports reported video watch photos pictures analysis " +
    "opinion explainer what's know things day days week year years first last one two three time times today yesterday tomorrow " +
    "monday tuesday wednesday thursday friday saturday sunday may could us via get gets got make makes made take takes took amid " +
    "km mi down just huge breaking least nearly around about several many dozens hundreds"
  ).split(/\s+/),
);

/** Lowercases, splits into words, drops stop words and pure numbers, and applies light stemming. */
export function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  return words.map((w) => SYNONYMS.get(w) ?? stem(w));
}

/** Common headline variants mapped to one word. */
const SYNONYMS = new Map<string, string>([
  ["quake", "earthquake"], ["quakes", "earthquake"], ["tremor", "earthquake"], ["temblor", "earthquake"],
  ["dead", "kill"], ["death", "kill"], ["deaths", "kill"], ["died", "kill"], ["dies", "kill"], ["killing", "kill"], ["killed", "kill"], ["kills", "kill"],
  ["wounded", "injur"], ["injured", "injur"], ["injuries", "injur"], ["injury", "injur"], ["hurt", "injur"],
  ["gunman", "shoot"], ["shooting", "shoot"], ["shootings", "shoot"], ["gunfire", "shoot"], ["shots", "shoot"], ["shot", "shoot"],
  ["flooding", "flood"], ["floods", "flood"], ["flooded", "flood"],
  ["blast", "explosion"], ["explosions", "explosion"], ["exploded", "explosion"],
]);

/** Very light suffix stripping: enough to match "killed/kills/killing" or "earthquakes/earthquake". */
export function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && /(ss|us|is)$/.test(word)) return word;
  if (word.length > 3 && word.endsWith("es") && /(sh|ch|x|z)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

export type SparseVector = Map<string, number>;

export function cosine(a: SparseVector, b: SparseVector): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other !== undefined) dot += weight * other;
  }
  if (dot === 0) return 0;
  return dot / (norm(a) * norm(b));
}

/** Share of `small`'s weight that also appears in `large`. Fair to short texts (social posts, terse headlines). */
export function containment(small: SparseVector, large: SparseVector): number {
  let inside = 0;
  let total = 0;
  for (const [term, weight] of small) {
    total += weight * weight;
    if (large.has(term)) inside += weight * weight;
  }
  return total === 0 ? 0 : inside / total;
}

/** Similarity used for grouping: cosine, or (discounted) containment of the shorter text in the longer one. */
export function similarity(a: SparseVector, b: SparseVector): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  return Math.max(cosine(a, b), 0.6 * containment(small, large));
}

export function sharedTerms(a: SparseVector, b: SparseVector): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const term of small.keys()) if (large.has(term)) shared += 1;
  return shared;
}

export function norm(v: SparseVector): number {
  let sum = 0;
  for (const w of v.values()) sum += w * w;
  return Math.sqrt(sum);
}

export function addInto(target: SparseVector, v: SparseVector): void {
  for (const [term, weight] of v) target.set(term, (target.get(term) ?? 0) + weight);
}

/** TF-IDF over a fixed corpus. Rare words (names, places) count more than common ones. */
export class TfIdf {
  readonly #df = new Map<string, number>();
  #docs = 0;

  addDocument(terms: Iterable<string>): void {
    this.#docs += 1;
    for (const term of new Set(terms)) this.#df.set(term, (this.#df.get(term) ?? 0) + 1);
  }

  get documentCount(): number {
    return this.#docs;
  }

  documentFrequency(term: string): number {
    return this.#df.get(term) ?? 0;
  }

  idf(term: string): number {
    return Math.log((this.#docs + 1) / ((this.#df.get(term) ?? 0) + 1)) + 1;
  }

  /** Weighted term counts → TF-IDF vector. */
  vector(termCounts: Map<string, number>): SparseVector {
    const v: SparseVector = new Map();
    for (const [term, count] of termCounts) v.set(term, (1 + Math.log(count)) * this.idf(term));
    return v;
  }
}

/** Title words count double: headlines carry the event; summaries add context. */
export function weightedTerms(title: string, summary?: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tokenize(title)) counts.set(t, (counts.get(t) ?? 0) + 2);
  for (const t of tokenize(summary ?? "")) counts.set(t, (counts.get(t) ?? 0) + 1);
  return counts;
}
