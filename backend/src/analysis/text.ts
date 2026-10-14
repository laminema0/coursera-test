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
    "km mi down just huge breaking least nearly around about several many dozens hundreds " +
    // Machine-feed boilerplate (USGS, GDACS): "41 km SSW of …, depth 35 km, PAGER alert".
    "nnw nne ene ese sse ssw wsw wnw ne nw se sw depth utc pager"
  ).split(/\s+/),
);

/**
 * Lowercases, splits into words, drops stop words and whole numbers, and applies light stemming.
 * Decimals stay ("6.8"): a magnitude or rate identifies a story. Machine titles are normalized first:
 * USGS "M 6.8 - 41 km SW of Arequipa" and GDACS "Magnitude 6.8M" both read as "magnitude 6.8".
 */
export function tokenize(text: string): string[] {
  const decimals: string[] = [];
  const words = text
    .toLowerCase()
    .replace(/(?<![\p{L}\p{N}])m\s?(\d\.\d)(?![\p{N}])/gu, "magnitude $1")
    .replace(/(\d\.\d)m\b/g, "$1")
    .replace(/\d+\.\d+/g, (d) => {
      decimals.push(d);
      return " ";
    })
    .replace(/['’]s\b/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  return [...words.map(normalize), ...decimals];
}

function normalize(word: string): string {
  const synonym = SYNONYMS.get(word) ?? DEMONYMS.get(word);
  if (synonym) return synonym;
  for (const [prefix, family] of WORD_FAMILIES) if (word.startsWith(prefix)) return family;
  return stem(word);
}

/** Word families the light stemmer can't join: "evacuated" / "evacuation" / "evacuees". */
const WORD_FAMILIES: [string, string][] = [["evacu", "evacuat"], ["rescu", "rescue"]];

/** "Kenyan police" and "Kenya protests" are about the same country. */
const DEMONYMS = new Map<string, string>(
  ("kenyan:kenya chinese:china turkish:turkey peruvian:peru indonesian:indonesia japanese:japan filipino:philippine " +
    "nigerian:nigeria sudanese:sudan ukrainian:ukraine russian:russia iranian:iran israeli:israel pakistani:pakistan indian:india " +
    "bangladeshi:bangladesh nepali:nepal nepalese:nepal mexican:mexico brazilian:brazil chilean:chile haitian:haiti ugandan:uganda " +
    "german:germany french:france british:britain spanish:spain portuguese:portugal italian:italy greek:greece icelandic:iceland " +
    "canadian:canada australian:australia egyptian:egypt syrian:syria iraqi:iraq afghan:afghanistan lebanese:lebanon qatari:qatar " +
    "emirati:uae korean:korea vietnamese:vietnam thai:thailand malaysian:malaysia ethiopian:ethiopia somali:somalia " +
    "congolese:congo colombian:colombia venezuelan:venezuela argentine:argentina argentinian:argentina polish:poland dutch:netherlands " +
    "swedish:sweden norwegian:norway taiwanese:taiwan burmese:myanmar palestinian:palestine yemeni:yemen libyan:libya")
    .split(" ")
    .map((pair) => pair.split(":") as [string, string]),
);

/** Common headline variants mapped to one word. */
const SYNONYMS = new Map<string, string>([
  ["quake", "earthquake"], ["quakes", "earthquake"], ["tremor", "earthquake"], ["temblor", "earthquake"],
  ["dead", "kill"], ["death", "kill"], ["deaths", "kill"], ["died", "kill"], ["dies", "kill"], ["killing", "kill"], ["killed", "kill"], ["kills", "kill"],
  ["wounded", "injur"], ["injured", "injur"], ["injuries", "injur"], ["injury", "injur"], ["hurt", "injur"],
  ["gunman", "shoot"], ["gunmen", "shoot"], ["shooting", "shoot"], ["shootings", "shoot"], ["gunfire", "shoot"], ["shots", "shoot"], ["shot", "shoot"],
  ["flooding", "flood"], ["floods", "flood"], ["flooded", "flood"],
  ["blast", "explosion"], ["explosions", "explosion"], ["exploded", "explosion"],
  ["vote", "election"], ["votes", "election"], ["voting", "election"], ["ballot", "election"], ["elections", "election"],
  ["mayoral", "mayor"], ["presidential", "president"],
  ["wins", "win"], ["won", "win"], ["winning", "win"], ["victory", "win"],
  // Same phenomenon, different regional names; official feeds (GDACS) say "tropical cyclone".
  ["typhoon", "cyclone"], ["typhoons", "cyclone"], ["hurricane", "cyclone"], ["hurricanes", "cyclone"], ["cyclones", "cyclone"],
  ["wildfire", "fire"], ["wildfires", "fire"], ["blaze", "fire"], ["bushfire", "fire"], ["fires", "fire"],
  ["derails", "derail"], ["derailed", "derail"], ["derailment", "derail"],
  ["collapsed", "collapse"], ["collapses", "collapse"], ["collapsing", "collapse"],
  ["capsizes", "capsize"], ["capsized", "capsize"], ["shipwreck", "capsize"],
  ["stabbing", "stab"], ["stabbed", "stab"], ["stabbings", "stab"], ["knife", "stab"],
  ["erupts", "erupt"], ["erupted", "erupt"], ["eruption", "erupt"], ["volcanic", "volcano"],
  ["ceasefire", "truce"], ["shelling", "shell"], ["shelled", "shell"], ["shells", "shell"], ["airstrikes", "airstrike"],
  ["bombing", "bomb"], ["bombings", "bomb"], ["bombed", "bomb"], ["missiles", "missile"], ["strikes", "strike"], ["struck", "strike"],
  ["protests", "protest"], ["protesters", "protest"], ["protester", "protest"], ["demonstrators", "protest"], ["demonstration", "protest"], ["demonstrations", "protest"],
]);

/** Kinds of incident a headline can be about. Words in the same group can describe one incident. */
const INCIDENT_GROUPS: Record<string, string[]> = {
  earthquake: ["quake"], tsunami: ["quake"], aftershock: ["quake"], collapse: ["quake", "blast", "collapse"], landslide: ["quake", "weather"],
  cyclone: ["weather"], storm: ["weather"], flood: ["weather"], tornado: ["weather"], rain: ["weather"],
  fire: ["blast"], explosion: ["blast"],
  shoot: ["violence"], stab: ["violence"],
  crash: ["crash"], derail: ["crash"], plane: ["crash"],
  capsize: ["sinking"], ferry: ["sinking"],
  erupt: ["volcano"], volcano: ["volcano"], lava: ["volcano"],
  election: ["election"], protest: ["protest"], outbreak: ["outbreak"],
  // Armed attacks. ("Strike" is left out: earthquakes, storms, armies and unions all strike.)
  shell: ["attack"], airstrike: ["attack"], bomb: ["attack"], missile: ["attack"], drone: ["attack"], raid: ["attack"],
  walkout: ["labour"],
  truce: ["diplomacy"], talk: ["diplomacy"], summit: ["diplomacy"], sanction: ["diplomacy"],
};

/** Incident groups named in a headline ("Ferry capsizes off Sulawesi" → sinking). Empty for most non-incident news. */
export function incidentTypes(titleTerms: Iterable<string>): Set<string> {
  const types = new Set<string>();
  for (const term of titleTerms) for (const group of INCIDENT_GROUPS[term] ?? []) types.add(group);
  return types;
}

export function disjoint(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  for (const x of a) if (b.has(x)) return false;
  return true;
}

/** Very light suffix stripping: enough to match "killed/kills/killing" or "earthquakes/earthquake". */
export function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith("ing")) return undouble(word.slice(0, -3));
  if (word.length > 4 && word.endsWith("ed")) return undouble(word.slice(0, -2));
  if (word.length > 4 && /(ss|us|is)$/.test(word)) return word;
  if (word.length > 3 && word.endsWith("es") && /(sh|ch|x|z)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/** "winn" → "win", "stopp" → "stop" (after removing -ing/-ed). Keeps ll/ss/zz ("fall", "pass"). */
function undouble(stem: string): string {
  return /([^aeiouylsz])\1$/.test(stem) ? stem.slice(0, -1) : stem;
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

export function dot(a: SparseVector, b: SparseVector): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let sum = 0;
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other !== undefined) sum += weight * other;
  }
  return sum;
}

/** Dot product and number of shared terms in one pass (both are needed for every candidate). */
export function overlapOf(a: SparseVector, b: SparseVector): { dot: number; shared: number } {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let sum = 0;
  let shared = 0;
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other !== undefined) {
      sum += weight * other;
      shared += 1;
    }
  }
  return { dot: sum, shared };
}

const normSqCache = new WeakMap<SparseVector, number>();

/** Squared norm, cached. Only for vectors that never change after they are built (article vectors). */
export function frozenNormSq(v: SparseVector): number {
  let n = normSqCache.get(v);
  if (n === undefined) {
    n = 0;
    for (const w of v.values()) n += w * w;
    normSqCache.set(v, n);
  }
  return n;
}

/** Containment of the shorter of two frozen vectors in the other (see `containment`). */
export function pairContainment(a: SparseVector, b: SparseVector): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  const total = frozenNormSq(small);
  if (total === 0) return 0;
  let inside = 0;
  for (const [term, weight] of small) if (large.has(term)) inside += weight * weight;
  return inside / total;
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

/**
 * Words written as names in running text ("floods hit Sylhet and Sunamganj", "the IMF"): places, people, storms and
 * organizations identify an event far better than common words. Sentence-initial words are skipped, and so are
 * Title Case headlines ("Earthquake in Peru Kills at Least 17"), where capitals carry no information.
 */
export function nameTerms(title: string, summary?: string): Set<string> {
  const names = new Set<string>();
  const scan = (sentence: string) => {
    const words = sentence.split(/[\s,;()"“”‘]+/).filter(Boolean);
    words.forEach((word, i) => {
      if (i === 0 || /[:.!?]$/.test(words[i - 1]!)) return;
      if (/^[A-Z][\p{Ll}]/u.test(word) || /^[A-Z]{2,6}$/.test(word)) for (const t of tokenize(word)) names.add(t);
    });
  };
  const titleWords = title.split(/\s+/).filter((w) => w.length > 3);
  const titleCase = titleWords.length > 2 && titleWords.filter((w) => /^[A-Z]/.test(w)).length / titleWords.length > 0.7;
  if (!titleCase) scan(title);
  for (const sentence of (summary ?? "").split(/(?<=[.!?])\s+/)) scan(sentence);
  return names;
}

/** Title words count double: headlines carry the event; summaries add context. */
export function weightedTerms(title: string, summary?: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tokenize(title)) counts.set(t, (counts.get(t) ?? 0) + 2);
  for (const t of tokenize(summary ?? "")) counts.set(t, (counts.get(t) ?? 0) + 1);
  return counts;
}
