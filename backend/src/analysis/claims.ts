// Rule-based claim extraction (free, fast, testable). English only for now.

export type CountKind = "killed" | "injured" | "missing" | "arrested" | "evacuated" | "displaced" | "magnitude";
export type Qualifier = "exact" | "atLeast" | "moreThan" | "upTo" | "about";
export type AttributionType = "official" | "witness" | "media" | "unattributed";

export interface NumberClaim {
  kind: CountKind;
  value: number;
  qualifier: Qualifier;
  /** Who the number comes from, according to the sentence it was found in. */
  attribution: AttributionType;
  /** The matched words, for display and debugging. */
  text: string;
}

export interface StatementClaim {
  /** Normalized speaker used to match the same speaker across sources (e.g. "weber", "finance ministry"). */
  speakerKey: string;
  speaker: string;
  verb: string;
  stance: "asserts" | "confirms" | "denies";
}

export interface ArticleClaims {
  numbers: NumberClaim[];
  statements: StatementClaim[];
  /** The article reports that something was denied, called false, or debunked (anywhere in the text). */
  denial: boolean;
  /** The denial is the headline: the article is *about* the denial. Only these dispute an event. */
  headlineDenial: boolean;
  /** The article reports a correction or retraction. */
  retraction: boolean;
  /** The correction or retraction is the headline. */
  headlineRetraction: boolean;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, "a dozen": 12, dozen: 12,
};

const NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d+|a dozen|${Object.keys(WORD_NUMBERS).filter((w) => w !== "a dozen").join("|")})`;
const QUAL = String.raw`(?:(at least|more than|over|up to|nearly|almost|around|about|some|approximately|roughly)\s+)?`;
const WHO = String.raw`(?:(?:people|persons|civilians|children|students|soldiers|officers|others|residents|migrants|workers|passengers|victims)\s+)?`;
const AUX = String.raw`(?:(?:were|was|have been|has been|had been|are|is|have|had|being)\s+)?`;

const OUTCOMES: [RegExp, CountKind][] = [
  [/^(killed|dead|died|dies|deaths?)$/, "killed"],
  [/^(injured|wounded|hurt|injuries)$/, "injured"],
  [/^(missing|unaccounted for)$/, "missing"],
  [/^(arrested|detained|in custody)$/, "arrested"],
  [/^(evacuated)$/, "evacuated"],
  [/^(displaced|homeless)$/, "displaced"],
];
const OUTCOME_WORDS = "killed|dead|died|dies|deaths?|injured|wounded|hurt|injuries|missing|unaccounted for|arrested|detained|evacuated|displaced|homeless";

const COUNT_PATTERN = new RegExp(String.raw`\b${QUAL}${NUM}\s+${WHO}${AUX}(${OUTCOME_WORDS})\b`, "gi");
const TOLL_PATTERN = new RegExp(String.raw`\bdeath toll\s+(?:has\s+)?(?:rises|rose|risen|climbs|climbed|reaches|reached|jumps|jumped|stands|stood|increases|increased|hits|hit)?\s*(?:to|at)?\s*${QUAL}${NUM}`, "gi");
const VERB_COUNT_PATTERN = new RegExp(String.raw`\b(kills|killing|injures|injuring|wounds|wounding)\s+${QUAL}${NUM}`, "gi");
const MAGNITUDE_PATTERN = /\b(?:magnitude(?:-|\s+)(?:of\s+)?(\d(?:\.\d)?)|(\d\.\d)(?:-|\s+)magnitude|M\s?(\d\.\d)\b)/gi;

const OFFICIAL = /\b(police|officials?|authorit(?:y|ies)|ministry|minister|government|governor|mayor|agency|department|spokes(?:man|woman|person)|coroner|hospital|health (?:ministry|officials)|fire (?:service|department)|army|military|civil defen[cs]e|disaster (?:agency|management)|AFAD|FEMA|Environment Agency|state media)\b/i;
const WITNESS = /\b(witness(?:es)?|residents|locals|bystanders|eyewitness(?:es)?|social media|videos? (?:posted|shared))\b/i;
const MEDIA = /\b(reported|according to (?:local |state )?(?:media|reports|radio|television|tv|newspaper)|Reuters|Associated Press|AFP|news agency)\b/i;

const DENIAL = /\b(den(?:y|ies|ied|ial)|reject(?:s|ed)?|refut(?:e|es|ed)|dismiss(?:es|ed)? (?:the )?(?:reports?|claims?)|false|fake|hoax|debunk(?:s|ed)?|no evidence|not true|misquot(?:e|ed)|fabricated|untrue)\b/i;
const RETRACTION = /\b(?:retract(?:s|ed|ion)?\b|withdr[ae]w (?:the |its |their )?(?:story|report|claim)\b|correction:|corrected an earlier\b)/i;

const STATEMENT_VERBS: Record<string, StatementClaim["stance"]> = {
  says: "asserts", said: "asserts", tells: "asserts", told: "asserts", warns: "asserts", warned: "asserts",
  announces: "asserts", announced: "asserts", claims: "asserts", claimed: "asserts", declares: "asserts", declared: "asserts",
  confirms: "confirms", confirmed: "confirms",
  denies: "denies", denied: "denies", rejects: "denies", rejected: "denies", refutes: "denies", refuted: "denies",
};
const STATEMENT_PATTERN = new RegExp(String.raw`([A-Za-z][\w.'’-]*(?:\s+[A-Za-z][\w.'’-]*){0,5})\s+(${Object.keys(STATEMENT_VERBS).join("|")})\b`, "g");
const ROLE_WORDS = /\b(minist(?:er|ry)|president|prime minister|chancellor|police|government|spokes(?:man|woman|person)|army|military|agency|governor|mayor|white house|kremlin|pentagon|officials?)\b/i;
const SPEAKER_STOP = new Set(["the", "a", "an", "and", "but", "that", "who", "which", "as", "after", "before", "when", "while", "of", "in", "on", "at", "to", "for", "with", "has", "have", "had", "reports", "report", "it", "this"]);

export function extractClaims(title: string, summary?: string): ArticleClaims {
  const sentences = [title, ...(summary ?? "").split(/(?<=[.!?])\s+/)].map((s) => s.trim()).filter(Boolean);
  const numbers: NumberClaim[] = [];
  const statements: StatementClaim[] = [];
  const seen = new Map<string, NumberClaim>();

  for (const sentence of sentences) {
    const attribution = attributionOf(sentence);
    const add = (kind: CountKind, rawNumber: string, rawQualifier: string | undefined, text: string) => {
      const value = parseNumber(rawNumber);
      if (value === undefined || (kind !== "magnitude" && value > 1_000_000)) return;
      const key = `${kind}:${value}`;
      const existing = seen.get(key);
      if (existing) {
        // Same number again (e.g. headline, then summary): keep the strongest attribution.
        if (ATTRIBUTION_RANK[attribution] > ATTRIBUTION_RANK[existing.attribution]) existing.attribution = attribution;
        return;
      }
      const claim: NumberClaim = { kind, value, qualifier: qualifierOf(rawQualifier), attribution, text: text.trim() };
      seen.set(key, claim);
      numbers.push(claim);
    };

    for (const m of sentence.matchAll(COUNT_PATTERN)) {
      const kind = outcomeKind(m[3]!);
      if (kind) add(kind, m[2]!, m[1], m[0]);
    }
    for (const m of sentence.matchAll(TOLL_PATTERN)) add("killed", m[2]!, m[1], m[0]);
    for (const m of sentence.matchAll(VERB_COUNT_PATTERN)) {
      const kind: CountKind = m[1]!.toLowerCase().startsWith("kill") ? "killed" : "injured";
      add(kind, m[3]!, m[2], m[0]);
    }
    for (const m of sentence.matchAll(MAGNITUDE_PATTERN)) add("magnitude", m[1] ?? m[2] ?? m[3]!, undefined, m[0]);

    for (const m of sentence.matchAll(STATEMENT_PATTERN)) {
      const speaker = cleanSpeaker(m[1]!);
      if (!speaker) continue;
      const verb = m[2]!.toLowerCase();
      statements.push({ speakerKey: speakerKeyOf(speaker), speaker, verb, stance: STATEMENT_VERBS[verb]! });
    }
  }

  const text = sentences.join(" ");
  return {
    numbers,
    statements: dedupeStatements(statements),
    denial: DENIAL.test(text),
    headlineDenial: DENIAL.test(title),
    retraction: RETRACTION.test(text),
    headlineRetraction: RETRACTION.test(title),
  };
}

const ATTRIBUTION_RANK: Record<AttributionType, number> = { unattributed: 0, media: 1, witness: 2, official: 3 };

export function parseNumber(raw: string): number | undefined {
  const lower = raw.toLowerCase();
  if (lower in WORD_NUMBERS) return WORD_NUMBERS[lower];
  const value = Number(lower.replace(/,/g, ""));
  return Number.isFinite(value) ? value : undefined;
}

function qualifierOf(raw: string | undefined): Qualifier {
  switch (raw?.toLowerCase()) {
    case "at least": return "atLeast";
    case "more than": case "over": return "moreThan";
    case "up to": return "upTo";
    case "nearly": case "almost": case "around": case "about": case "some": case "approximately": case "roughly": return "about";
    default: return "exact";
  }
}

function outcomeKind(word: string): CountKind | undefined {
  const lower = word.toLowerCase();
  return OUTCOMES.find(([pattern]) => pattern.test(lower))?.[1];
}

function attributionOf(sentence: string): AttributionType {
  // Order matters: "police said, citing witnesses" is still official.
  if (/\b(said|says|according to|confirmed|told|reported|announced)\b/i.test(sentence) || /^[^,]*:/.test(sentence)) {
    if (OFFICIAL.test(sentence)) return "official";
    if (WITNESS.test(sentence)) return "witness";
    if (MEDIA.test(sentence)) return "media";
  }
  if (OFFICIAL.test(sentence) && /\b(police|officials|authorities)\b/i.test(sentence)) return "official";
  return "unattributed";
}

/** Keeps the noun phrase right before the verb: "Ruritania finance minister Karl Weber". */
function cleanSpeaker(raw: string): string | undefined {
  const words = raw.split(/\s+/);
  let start = words.length;
  for (let i = words.length - 1; i >= 0; i -= 1) {
    const word = words[i]!;
    if (SPEAKER_STOP.has(word.toLowerCase()) || /[,:;]$/.test(word)) break;
    start = i;
  }
  const speaker = words.slice(start).join(" ");
  if (!speaker || /^(it|he|she|they|we|i|this|that)$/i.test(speaker)) return undefined;
  // A speaker needs a name (capitalized word) or a role ("police", "ministry").
  const hasName = speaker.split(/\s+/).some((w) => /^[A-Z]/.test(w));
  return hasName || ROLE_WORDS.test(speaker) ? speaker : undefined;
}

const INSTITUTION = /\b(?:([a-z]+)\s+)?(ministry|police|government|agency|army|military|white house|kremlin|pentagon|officials)\b/i;
const PERSON_ROLE = /\b(minister|president|prime minister|chancellor|governor|mayor|spokes(?:man|woman|person))\b/i;

/** "minister Karl Weber" → "weber"; "the finance ministry" → "finance ministry"; "Columbus police chief" → "columbus police". */
export function speakerKeyOf(speaker: string): string {
  const institution = speaker.match(INSTITUTION);
  if (institution && !PERSON_ROLE.test(speaker)) {
    const qualifier = institution[1] && !/^(the|a|an)$/i.test(institution[1]) ? `${institution[1]} ` : "";
    return `${qualifier}${institution[2]}`.toLowerCase();
  }
  const surname = speaker.split(/\s+/).filter((w) => /^[A-Z][\w'’-]+$/.test(w) && !ROLE_WORDS.test(w)).at(-1);
  return (surname ?? speaker).toLowerCase();
}

function dedupeStatements(statements: StatementClaim[]): StatementClaim[] {
  const seen = new Set<string>();
  return statements.filter((s) => {
    const key = `${s.speakerKey}:${s.stance}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
