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
  /** What the headline denies, e.g. "reports of leak" in "Operator denies reports of leak after quake". */
  deniedText?: string;
  /** The headline denies responsibility or accusations ("denies involvement", "…, blames the army"), not the event. */
  responsibilityDenial: boolean;
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

// "\b" after the number: "dozens" is not "a dozen"; "no one" is not one.
const NUM = String.raw`(?<!\bno\s)(\d{1,3}(?:,\d{3})+|\d+|a dozen|${Object.keys(WORD_NUMBERS).filter((w) => w !== "a dozen").join("|")})\b`;
const QUAL = String.raw`(?:(at least|more than|over|up to|nearly|almost|around|about|some|approximately|roughly)\s+)?`;
const PERSONS = "people|persons|person|civilians|children|students|soldiers|officers|others|residents|migrants|workers|passengers|victims|miners|members|suspects|protesters|demonstrators|tourists|pilgrims|crew members|guests|patients|troops|men|women";
const WHO = String.raw`(?:(?:${PERSONS})\s+)?`;
const AUX = String.raw`(?:(?:were|was|have been|has been|had been|are|is|have|had|being|remain|remains|remained|are still|were still|still|now)\s+)?`;

const OUTCOMES: [RegExp, CountKind][] = [
  [/^(killed|(?:confirmed |found |shot )?dead|died|dies|deaths?|drowned)$/, "killed"],
  [/^(injured|wounded|hurt|injuries)$/, "injured"],
  [/^(missing|unaccounted for)$/, "missing"],
  [/^(arrested|detained|in custody)$/, "arrested"],
  [/^(evacuated)$/, "evacuated"],
  [/^(displaced|homeless)$/, "displaced"],
];
const OUTCOME_WORDS = "killed|(?:confirmed |found |shot )?dead|died|dies|deaths?|drowned|injured|wounded|hurt|injuries|missing|unaccounted for|arrested|detained|evacuated|displaced|homeless";

// "18 people on board were killed", "All 18 aboard killed"
const ON_BOARD = String.raw`(?:(?:aboard|on board)\s+)?`;
const COUNT_PATTERN = new RegExp(String.raw`\b${QUAL}${NUM}\s+${WHO}${ON_BOARD}${AUX}(${OUTCOME_WORDS})\b`, "gi");
const TOLL_VERBS = "rises|rose|risen|climbs|climbed|reaches|reached|jumps|jumped|stands|stood|increases|increased|hits|hit|soars|soared|grows|grew";
// Each toll pattern captures (qualifier, number). "Toll" alone means the death toll in news copy ("toll climbs to 8").
const TOLL_PATTERNS = [
  new RegExp(String.raw`\bdeath toll\s+(?:has\s+)?(?:${TOLL_VERBS})?\s*(?:to|at)?\s*${QUAL}${NUM}`, "gi"),
  // "Death toll in Sulawesi earthquake rises to 7", "toll from the storm climbs to 6"
  new RegExp(String.raw`\b(?:death\s+)?toll(?:\s+(?:in|from|of|after|for)\s+[^.;:!?,]{1,60}?)?\s+(?:has\s+)?(?:${TOLL_VERBS})\s+(?:to|at)\s+${QUAL}${NUM}`, "gi"),
  // "raising the death toll from Hurricane Lorena to 11", "bringing the storm's death toll across the region to 11"
  new RegExp(String.raw`\b(?:raising|bringing|taking|pushing|lifting)\s+(?:the\s+)?(?:[\w'’-]+\s+){0,2}(?:death\s+)?toll(?:\s+(?:in|from|of|across|after)\s+[^.;:!?,]{1,60}?)?\s+to\s+${QUAL}${NUM}`, "gi"),
];
const VERB_KINDS: [RegExp, CountKind][] = [
  [/^kill/i, "killed"], [/^(injur|wound)/i, "injured"], [/^(arrest|detain)/i, "arrested"], [/^displac/i, "displaced"], [/^evacuat/i, "evacuated"],
];
// "kills 12" and, with a plural subject, "Floods kill at least 5".
const VERB_COUNT_PATTERN = new RegExp(String.raw`\b(kill|kills|killing|injure|injures|injuring|wound|wounds|wounding|arrests|arresting|detains|detaining|displace|displaces|displacing)\s+(?:all\s+)?${QUAL}${NUM}`, "gi");
// "six bodies had been recovered", "12 bodies were found"
const BODIES_PATTERN = new RegExp(String.raw`\b${QUAL}${NUM}\s+bodies\s+(?:(?:had|have|has)\s+been\s+|were\s+|was\s+)?(?:recovered|found|pulled|retrieved)`, "gi");
// "Iran claims arrest of 12 'Mossad agents'"
const ARREST_OF_PATTERN = new RegExp(String.raw`\barrests?\s+of\s+${QUAL}${NUM}`, "gi");
// "killed at least 5 people" (a person word is required, so "killed 2 days ago" doesn't match)…
const PAST_VERB_COUNT_PATTERN = new RegExp(String.raw`\b(killed|injured|wounded|arrested|detained|displaced|evacuated)\s+${QUAL}${NUM}\s+(?:${PERSONS})\b`, "gi");
// …unless an auxiliary makes it a verb ("has killed 2") or the clause ends right after the number ("…and injured 112.").
const PERFECT_VERB_COUNT_PATTERN = new RegExp(String.raw`\b(?:has|have|had)\s+(killed|injured|wounded|arrested|detained|displaced)\s+${QUAL}${NUM}`, "gi");
const CLAUSE_END_VERB_COUNT_PATTERN = new RegExp(String.raw`\b(killed|injured|wounded)\s+${QUAL}${NUM}(?=\s*(?:[,.;]|$|\band\b))`, "gi");
const LIVES_PATTERN = new RegExp(String.raw`\b(?:claimed|claiming|claims|cost|costing)\s+(?:the\s+)?${QUAL}${NUM}\s+lives\b|\b${QUAL}${NUM}\s+${WHO}(?:have\s+|had\s+)?lost\s+their\s+lives\b`, "gi");
const MAGNITUDE_PATTERN = /\b(?:magnitude(?:-|\s+)(?:of\s+)?(\d(?:\.\d)?)|(\d\.\d)(?:-|\s+)magnitude|M\s?(\d\.\d)\b)/gi;
// Evacuation figures are usually phrased around the order, not the outcome word.
const EVACUATION_PATTERNS = [
  // "forced the evacuation of about 15,000 residents", "evacuation order for 2,000 residents"
  new RegExp(String.raw`\bevacuations?(?:\s+orders?)?\s+(?:of|for)\s+${QUAL}${NUM}`, "gi"),
  // "15,000 people ordered to evacuate", "300,000 residents are under mandatory evacuation orders"
  new RegExp(String.raw`\b${QUAL}${NUM}\s+${WHO}(?:(?:were|are|have been|now)\s+)*(?:ordered|told|urged)\s+to\s+(?:evacuate|leave|flee)\b`, "gi"),
  new RegExp(String.raw`\b${QUAL}${NUM}\s+${WHO}(?:(?:were|are|now)\s+)*under\s+(?:mandatory\s+)?evacuation\s+orders?`, "gi"),
  // "evacuations expand to 30,000", "forced 30,000 to flee"
  new RegExp(String.raw`\bevacuations?\s+(?:expand|expanded|expands|widen|widened|widens|grow|grew|grows)\s+to\s+${QUAL}${NUM}`, "gi"),
  new RegExp(String.raw`\bforc(?:ed|es|ing)\s+${QUAL}${NUM}\s+${WHO}to\s+(?:flee|evacuate)\b`, "gi"),
];

const HAS_NUMBER = new RegExp(String.raw`\d|\b(?:${Object.keys(WORD_NUMBERS).join("|")})\b`, "i");
const HAS_OUTCOME = /kill|dead|died|dies|death|drown|injur|wound|hurt|missing|unaccounted|arrest|detain|custody|evacuat|displac|homeless|bodies/i;

// Background ("including one in 2016 that killed 42 people") and corrected figures ("An earlier version said two died")
// are not the event's numbers.
const BACKGROUND_CLAUSE = /\b(?:in|since|of)\s+(?:19|20)\d{2}\b|\byears? ago\b|\blast year\b/i;
const CORRECTED_SENTENCE = /\b(?:an earlier version|previously (?:reported|said)|wrongly|incorrectly)\b/i;

const OFFICIAL = /\b(police|officials?|authorit(?:y|ies)|ministry|minister|government|governor|mayor|sheriff|agency|department|administration|council|commission|spokes(?:man|woman|person)|coroner|hospital|medical (?:sources|staff|officials)|doctors|medics|health (?:ministry|officials)|fire (?:service|department|brigade|chief)|emergency services|rescue (?:services|teams|workers|agency)|coast ?guard|navy|army|military|civil defen[cs]e|disaster (?:agency|management|office)|human rights office|(?:geophysical|seismological|meteorological|geological) (?:institute|centre|center|service|survey|agency|office)|United Nations|Environment Agency|state (?:media|television|tv|broadcaster)|electoral commission)\b/i;
// Case-sensitive: "WHO" the agency, not "who".
const OFFICIAL_ACRONYMS = /\b(UN|WHO|IOM|OCHA|UNICEF|UNHCR|USGS|FEMA|NTSB|EU)\b/;
const MEDIA_ACRONYMS = new Set(["AP", "AFP", "BBC", "CNN", "NBC", "CBS", "ABC", "NPR", "PA", "DPA", "ANI", "PTI", "CCTV", "TV"]);
const WITNESS = /\b(witness(?:es)?|residents|locals|bystanders|eyewitness(?:es)?|activists|social media|videos? (?:posted|shared))\b/i;
const MEDIA = /\b((?<!\b(?:been|was|were|is|are|be|being)\s)reported|media|according to (?:local |state )?(?:reports|radio|television|tv|newspaper)|Reuters|Associated Press|AFP|news agency)\b/i;
// A sentence carries an attribution: a speech verb, or a headline credit ("… - USGS", "… — emergency services").
const ATTRIBUTION_VERB = /\b(said|says|say|claims|claimed|according to|confirmed|told|reported|reports|announced|estimated)\b/i;
const HEADLINE_CREDIT = /\s[-–—]\s+(?:[\w.'’]+\s?){1,4}$/;
// "Iran says…", "Qatar says…": a country or institution named as the speaker is the government's voice.
const NAMED_SPEAKER = /^(?:[A-Z][a-z]+\s){1,2}(?:says|said|claims|confirms)\b/;

const DENIAL_WORDS = String.raw`den(?:y|ies|ied)|reject(?:s|ed)?|refut(?:e|es|ed)|contradict(?:s|ed|ing)?|dismiss(?:es|ed)? (?:the )?(?:reports?|claims?)|false|fake|hoax|debunk(?:s|ed)?|no evidence|not true|misquot(?:e|ed)|fabricated|untrue`;
const DENIAL = new RegExp(String.raw`\b(${DENIAL_WORDS}|denial)\b`, "i");
// In a headline, the noun "denial" usually refers to an earlier denial ("…after Fund denial"), so only verbs count.
const HEADLINE_DENIAL = new RegExp(String.raw`\b(${DENIAL_WORDS})\b`, "i");
// "X denies responsibility", "rejects accusations", "…, blames the army": disputes who did it, not that it happened.
const RESPONSIBILITY = /\b(responsibility|involvement|accusations?|allegations?|blames?|blaming|role in)\b/i;
const RETRACTION = /\b(?:retract(?:s|ed|ion)?\b|withdr[ae]w (?:the |its |their )?(?:story|report|claim)\b|correction:|corrected an earlier\b)/i;

const STATEMENT_VERBS: Record<string, StatementClaim["stance"]> = {
  says: "asserts", said: "asserts", tells: "asserts", told: "asserts", warns: "asserts", warned: "asserts",
  announces: "asserts", announced: "asserts", claims: "asserts", claimed: "asserts", declares: "asserts", declared: "asserts",
  confirms: "confirms", confirmed: "confirms",
  denies: "denies", denied: "denies", rejects: "denies", rejected: "denies", refutes: "denies", refuted: "denies",
};
const STATEMENT_VERB = new RegExp(String.raw`\b(?:${Object.keys(STATEMENT_VERBS).join("|")})\b`);
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
    const corrected = CORRECTED_SENTENCE.test(sentence);
    const add = (kind: CountKind, rawNumber: string, rawQualifier: string | undefined, m: RegExpMatchArray) => {
      const value = parseNumber(rawNumber);
      if (value === undefined || (kind !== "magnitude" && value > 1_000_000)) return;
      if (corrected || isBackground(sentence, m.index ?? 0, m[0].length)) return;
      const key = `${kind}:${value}`;
      const qualifier = qualifierOf(rawQualifier);
      const existing = seen.get(key);
      if (existing) {
        // Same number again (e.g. headline, then summary): keep the strongest attribution, and the hedge if any.
        if (ATTRIBUTION_RANK[attribution] > ATTRIBUTION_RANK[existing.attribution]) existing.attribution = attribution;
        if (existing.qualifier === "exact") existing.qualifier = qualifier;
        return;
      }
      const claim: NumberClaim = { kind, value, qualifier, attribution, text: m[0].trim() };
      seen.set(key, claim);
      numbers.push(claim);
    };

    // Cheap keyword checks first: most sentences have no figure, and the full patterns are costly at 20k articles.
    if (HAS_NUMBER.test(sentence)) {
      if (HAS_OUTCOME.test(sentence)) {
        for (const m of sentence.matchAll(COUNT_PATTERN)) {
          const kind = outcomeKind(m[3]!);
          if (kind) add(kind, m[2]!, m[1], m);
        }
        for (const pattern of [VERB_COUNT_PATTERN, PAST_VERB_COUNT_PATTERN, PERFECT_VERB_COUNT_PATTERN, CLAUSE_END_VERB_COUNT_PATTERN]) {
          for (const m of sentence.matchAll(pattern)) {
            const kind = VERB_KINDS.find(([verb]) => verb.test(m[1]!))?.[1];
            if (kind) add(kind, m[3]!, m[2], m);
          }
        }
      }
      if (/toll/i.test(sentence)) for (const pattern of TOLL_PATTERNS) for (const m of sentence.matchAll(pattern)) add("killed", m[2]!, m[1], m);
      if (/evacuat|flee/i.test(sentence)) for (const pattern of EVACUATION_PATTERNS) for (const m of sentence.matchAll(pattern)) add("evacuated", m[2]!, m[1], m);
      if (/bodies/i.test(sentence)) for (const m of sentence.matchAll(BODIES_PATTERN)) add("killed", m[2]!, m[1], m);
      if (/arrests? of/i.test(sentence)) for (const m of sentence.matchAll(ARREST_OF_PATTERN)) add("arrested", m[2]!, m[1], m);
      if (/lives/i.test(sentence)) for (const m of sentence.matchAll(LIVES_PATTERN)) add("killed", m[2] ?? m[4]!, m[1] ?? m[3], m);
      if (/\d\.\d|magnitude/i.test(sentence)) for (const m of sentence.matchAll(MAGNITUDE_PATTERN)) add("magnitude", m[1] ?? m[2] ?? m[3]!, undefined, m);
    }

    if (STATEMENT_VERB.test(sentence)) for (const m of sentence.matchAll(STATEMENT_PATTERN)) {
      const speaker = cleanSpeaker(m[1]!);
      if (!speaker) continue;
      const verb = m[2]!.toLowerCase();
      statements.push({ speakerKey: speakerKeyOf(speaker), speaker, verb, stance: STATEMENT_VERBS[verb]! });
    }
  }

  const text = sentences.join(" ");
  const headlineDenial = HEADLINE_DENIAL.exec(title);
  return {
    numbers,
    statements: dedupeStatements(statements),
    denial: DENIAL.test(text),
    headlineDenial: headlineDenial !== null,
    deniedText: headlineDenial ? deniedTextOf(title, headlineDenial) : undefined,
    responsibilityDenial: headlineDenial !== null && RESPONSIBILITY.test(title),
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
  // "Police: 3 dead" — a speaker label before a colon (but not a topic label: "Kenya protests: two killed").
  const label = /^([^:,]{1,40}):\s/.exec(sentence);
  const labelSource = label ? sourceTypeOf(label[1]!) : undefined;
  if (labelSource) return labelSource;
  if (!ATTRIBUTION_VERB.test(sentence) && !HEADLINE_CREDIT.test(sentence)) return "unattributed";
  // The speaker is the phrase attached to the speech verb: in "Police arrested 30 people, a Reuters witness said"
  // the number comes from the witness, not the police.
  for (const phrase of speakerPhrases(sentence)) {
    const type = sourceTypeOf(phrase);
    if (type) return type;
  }
  // Order matters: "police said, citing witnesses" is still official.
  return sourceTypeOf(sentence) ?? (NAMED_SPEAKER.test(sentence) ? "official" : "unattributed");
}

/** "…, local authorities said" → "local authorities"; "according to the health ministry" → "the health ministry". */
function speakerPhrases(sentence: string): string[] {
  const phrases: string[] = [];
  for (const m of sentence.matchAll(/\b(?:said|says|say|told|reported|reports|announced|confirmed|estimated)\b/gi)) {
    const before = sentence.slice(0, m.index);
    const start = Math.max(before.lastIndexOf(","), before.lastIndexOf(";"), before.lastIndexOf(":"), before.lastIndexOf("—")) + 1;
    const words = before.slice(start).trim().split(/\s+/).filter(Boolean);
    if (words.length > 0) phrases.push(words.slice(-6).join(" "));
  }
  for (const m of sentence.matchAll(/\baccording to ([^,.;]+)/gi)) phrases.push(m[1]!);
  const credit = HEADLINE_CREDIT.exec(sentence);
  if (credit) phrases.push(credit[0]);
  return phrases;
}

function sourceTypeOf(text: string): AttributionType | undefined {
  if (OFFICIAL.test(text) || OFFICIAL_ACRONYMS.test(text) || hasAgencyAcronym(text)) return "official";
  if (WITNESS.test(text)) return "witness";
  if (MEDIA.test(text)) return "media";
  return undefined;
}

/** "The NDRRMC said", "LASEMA said": an unknown all-caps acronym as the speaker is almost always an agency. */
function hasAgencyAcronym(text: string): boolean {
  for (const m of text.matchAll(/\b([A-Z]{3,8})\s+(?:said|says|reported)\b/g)) if (!MEDIA_ACRONYMS.has(m[1]!)) return true;
  return false;
}

/** The match sits in a clause about the past ("…including one in 2016 that killed 42 people"). */
function isBackground(sentence: string, index: number, length: number): boolean {
  const before = sentence.slice(0, index);
  const start = Math.max(before.lastIndexOf(","), before.lastIndexOf(";"), before.lastIndexOf("—")) + 1;
  const rest = sentence.slice(index + length);
  const endMatch = /[,;.—]/.exec(rest);
  const clause = sentence.slice(start, index + length + (endMatch ? endMatch.index : rest.length));
  return BACKGROUND_CLAUSE.test(clause);
}

/** The words after the denial verb, up to the next clause: what is being denied. */
function deniedTextOf(title: string, match: RegExpExecArray): string {
  const after = title.slice(match.index + match[0].length);
  return after.split(/,|;|:|\s[-–—]\s|\b(?:after|following|amid|as|over|says?|said)\b/i)[0]!.trim();
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
