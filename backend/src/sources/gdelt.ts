// GDELT DOC 2.0 API: free, worldwide news monitoring (https://www.gdeltproject.org).
// Used only to measure how widely an event is covered, never as confirmation (sources are not curated).

export interface Coverage {
  query: string;
  outlets: number;
  countries: number;
  /** Earliest time GDELT saw an article for this query (within the time span). */
  firstSeenAt?: string;
  checkedAt: string;
}

interface GdeltArticle {
  url?: string;
  domain?: string;
  sourcecountry?: string;
  seendate?: string;
  language?: string;
}

const API = "https://api.gdeltproject.org/api/v2/doc/doc";
const QUERY_STOP = new Set(["the", "a", "an", "in", "on", "at", "of", "to", "for", "and", "as", "after", "with", "by", "from", "says", "say", "said", "is", "are", "was", "be", "new", "live", "latest", "breaking", "update", "updates", "police", "news"]);

/** Capitalized only because they start a headline or clause; not names. */
const HEADLINE_WORDS = new Set(["strong", "huge", "major", "deadly", "massive", "big", "more", "many", "several", "two", "three", "watch", "how", "why", "what", "who", "where", "when", "first", "last", "man", "woman", "people", "officials", "report", "reports", "death", "dead", "fire", "explosion", "attack", "shooting", "earthquake", "storm", "flood"]);

/**
 * Builds a GDELT query from a headline: up to 3 names (places, people, organisations) plus one specific keyword.
 * Names mid-sentence are the strongest signal; capitalized clause-initial words count only if they aren't
 * ordinary headline words. GDELT needs words of 3+ letters; quoted phrases are avoided because headlines vary.
 */
export function gdeltQueryFor(title: string): string | undefined {
  const clauses = title.replace(/['’]s\b/g, "").split(/[:;—–|]|\s-\s/);
  const midNames: string[] = [];
  const initialNames: string[] = [];
  const keywords: string[] = [];

  for (const clause of clauses) {
    const words = clause.split(/[^\p{L}\p{N}-]+/u).filter((w) => w.length >= 3 && !/^\d/.test(w));
    words.forEach((word, i) => {
      const lower = word.toLowerCase();
      if (QUERY_STOP.has(lower)) return;
      if (/^\p{Lu}/u.test(word)) {
        if (i > 0) midNames.push(word);
        else if (!HEADLINE_WORDS.has(lower)) initialNames.push(word);
        else if (word.length >= 5) keywords.push(lower);
      } else if (word.length >= 5) {
        keywords.push(lower);
      }
    });
  }

  const names = [...new Set([...midNames, ...initialNames])].slice(0, 3);
  const extra = [...new Set(keywords)].slice(0, names.length >= 2 ? 1 : 2);
  const terms = [...names, ...extra];
  if (terms.length < 2) return undefined;
  return `${terms.join(" ")} sourcelang:english`;
}

export function parseSeenDate(value: string | undefined): string | undefined {
  const m = value?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z` : undefined;
}

export async function fetchCoverage(query: string, fetchImpl: typeof fetch = fetch, now: Date = new Date()): Promise<Coverage> {
  const params = new URLSearchParams({ query, mode: "ArtList", format: "json", maxrecords: "250", timespan: "24h", sort: "DateDesc" });
  const response = await fetchImpl(`${API}?${params}`, {
    headers: { "User-Agent": "NewsVerify/0.1 (independent non-commercial project)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`GDELT HTTP ${response.status}`);
  const body = await response.text();
  // GDELT answers some invalid queries with a plain-text message instead of JSON.
  let articles: GdeltArticle[] = [];
  try {
    articles = (JSON.parse(body) as { articles?: GdeltArticle[] }).articles ?? [];
  } catch {
    throw new Error(`GDELT: ${body.slice(0, 120)}`);
  }
  const domains = new Set(articles.map((a) => a.domain).filter(Boolean));
  const countries = new Set(articles.map((a) => a.sourcecountry).filter(Boolean));
  const firstSeen = articles.map((a) => parseSeenDate(a.seendate)).filter((d): d is string => Boolean(d)).sort()[0];
  return { query, outlets: domains.size, countries: countries.size, firstSeenAt: firstSeen, checkedAt: now.toISOString() };
}

/**
 * Checks coverage for a few events per cycle, at most one GDELT request every `intervalMs` (GDELT asks for ≥5 s),
 * and keeps results for `ttlMs`.
 */
export class CoverageTracker {
  readonly #cache = new Map<string, Coverage>();
  readonly #fetch: typeof fetch;
  readonly #now: () => Date;
  readonly #intervalMs: number;
  readonly #ttlMs: number;
  readonly #sleep: (ms: number) => Promise<void>;

  constructor(options: { fetch?: typeof fetch; now?: () => Date; intervalMs?: number; ttlMs?: number; sleep?: (ms: number) => Promise<void> } = {}) {
    this.#fetch = options.fetch ?? fetch;
    this.#now = options.now ?? (() => new Date());
    this.#intervalMs = options.intervalMs ?? 6_000;
    this.#ttlMs = options.ttlMs ?? 15 * 60_000;
    this.#sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  get(eventId: string): Coverage | undefined {
    return this.#cache.get(eventId);
  }

  /** Refreshes coverage for up to `max` events whose cached value is missing or stale. Returns how many were checked. */
  async refresh(events: { id: string; title: string }[], max: number): Promise<number> {
    const now = this.#now().getTime();
    const due = events.filter((e) => {
      const cached = this.#cache.get(e.id);
      return !cached || now - Date.parse(cached.checkedAt) > this.#ttlMs;
    }).slice(0, max);

    let checked = 0;
    for (const [i, event] of due.entries()) {
      const query = gdeltQueryFor(event.title);
      if (!query) continue;
      if (i > 0) await this.#sleep(this.#intervalMs);
      try {
        this.#cache.set(event.id, await fetchCoverage(query, this.#fetch, this.#now()));
        checked += 1;
      } catch {
        // Coverage is optional; try again next cycle.
      }
    }
    return checked;
  }

  /** Drops cached coverage for events that no longer exist. */
  retain(eventIds: Set<string>): void {
    for (const id of this.#cache.keys()) if (!eventIds.has(id)) this.#cache.delete(id);
  }
}
