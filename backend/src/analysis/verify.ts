import type { Article, NewsSource } from "../sources/types.ts";
import { type ArticleClaims, type CountKind, extractClaims, type NumberClaim, type Qualifier } from "./claims.ts";
import { mentionsCountry } from "./countries.ts";
import { tokenize } from "./text.ts";
import { clusterArticles, type ClusterOptions, defaultClusterOptions, type EventOrigin, type NewsEvent } from "./cluster.ts";

export type VerificationStatus = "unverified" | "reported" | "corroborated" | "confirmed" | "disputed" | "retracted";

export interface Verification {
  status: VerificationStatus;
  /** Independent origins (excluding social signals) reporting the event. */
  confirming: number;
  /** Independent origins reporting a denial, "false" or "debunked". */
  disputing: number;
  /** Official sources (USGS, UN, governments…) among the origins. */
  primary: number;
  /** Independent origins with strong editorial standards (tier 1). */
  tier1: number;
  /** Social posts only count as early signals. */
  signals: number;
  /** State-funded outlets reporting on their own country: the government's voice, not independent confirmation. */
  stateMediaOwnCountry: number;
  /** One-line, plain-language reason for the status. */
  reason: string;
}

export interface NumberReport {
  value: number;
  qualifier: Qualifier;
  attribution: NumberClaim["attribution"];
  official: boolean;
  originKey: string;
  sourceId: string;
  articleId: string;
  at: string;
}

export interface NumberSummary {
  kind: CountKind;
  min: number;
  max: number;
  /** Value reported by the most independent origins (each origin's latest value). Ties go to the newer value. */
  mostReported: { value: number; origins: number };
  /** Newest value from an official source or attributed to officials. */
  latestOfficial?: { value: number; at: string; sourceId: string };
  /** Each origin's reports over time, oldest first. */
  timeline: NumberReport[];
  /** Numbers mentioned in social posts (unverified chatter), most mentioned first. Never part of the figures above. */
  chatter: { value: number; mentions: number }[];
}

/** Numbers that so far appear only in social posts. */
export interface ChatterOnly {
  kind: CountKind;
  values: { value: number; mentions: number }[];
}

export interface StatementSummary {
  speakerKey: string;
  speaker: string;
  asserts: number;
  denies: number;
  confirms: number;
}

export interface VerifiedEvent extends NewsEvent {
  verification: Verification;
  /** Earliest report from a news or official source (social posts excluded). */
  firstReport?: { sourceId: string; articleId: string; at: string };
  numbers: NumberSummary[];
  /** Kinds of numbers mentioned only on social media so far (unverified). */
  chatterOnly: ChatterOnly[];
  statements: StatementSummary[];
}

/** Full analysis: group articles into events, extract claims, assign statuses and summarize numbers. */
export function analyze(
  articles: Article[],
  sources: Map<string, NewsSource>,
  options: ClusterOptions = defaultClusterOptions,
): VerifiedEvent[] {
  const claimsById = new Map(articles.map((a) => [a.id, extractClaims(a.title, a.summary)]));
  const articleById = new Map(articles.map((a) => [a.id, a]));
  return clusterArticles(articles, sources, options)
    .map((event) => verifyEvent(event, articleById, claimsById, sources))
    .sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
}

export function verifyEvent(
  event: NewsEvent,
  articles: Map<string, Article>,
  claims: Map<string, ArticleClaims>,
  sources: Map<string, NewsSource>,
): VerifiedEvent {
  const eventText = event.articleIds.map((id) => `${articles.get(id)?.title ?? ""} ${articles.get(id)?.summary ?? ""}`).join(" ");
  const ownCountryStateMedia = event.origins.filter((o) => isOwnCountryStateMedia(o, eventText, sources));
  const counted = event.origins.filter((o) => o.kind !== "signal" && !ownCountryStateMedia.includes(o));
  const disputes = disputingArticles(event, articles, claims);
  const disputingOrigins = counted.filter((o) => o.articleIds.some((id) => disputes.has(id)));
  const confirmingOrigins = counted.filter((o) => o.articleIds.some((id) => !disputes.has(id)));
  // A correction retracts the event when it negates the core claim ("…has not been arrested"), or when too
  // few other sources remain. Correcting a detail ("crash caused no deaths, 20 injured") leaves the event.
  const correctingOrigins = counted.filter((o) => o.articleIds.some((id) => claims.get(id)?.headlineRetraction));
  const fullRetraction = event.articleIds.some((id) => {
    const c = claims.get(id);
    return c?.headlineRetraction && isCoreRetraction(articles.get(id)?.title ?? "", c);
  });
  const othersConfirming = confirmingOrigins.filter((o) => !correctingOrigins.includes(o));
  const retracting = correctingOrigins.length > 0 && (fullRetraction || othersConfirming.length < 2);
  const partlyCorrected = correctingOrigins.length > 0 && !retracting;

  const verification = statusOf({
    confirming: confirmingOrigins.length,
    disputing: disputingOrigins.length,
    primary: counted.filter((o) => o.kind === "primary").length,
    tier1: confirmingOrigins.filter((o) => o.tier === 1).length,
    signals: event.origins.filter((o) => o.kind === "signal").length,
    stateMediaOwnCountry: ownCountryStateMedia.length,
    retracting,
  });
  if (partlyCorrected) verification.reason += " One source corrected a detail of its earlier report.";

  const firstReport = counted
    .flatMap((o) => o.articleIds.map((id) => articles.get(id)))
    .filter((a): a is Article => a !== undefined)
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))[0];

  const numbers = summarizeNumbers(event.origins, articles, claims, sources, disputes);
  return {
    ...event,
    verification,
    firstReport: firstReport && { sourceId: firstReport.sourceIds[0] ?? "", articleId: firstReport.id, at: firstReport.publishedAt },
    numbers: numbers.summaries,
    chatterOnly: numbers.chatterOnly,
    statements: summarizeStatements(counted, claims),
  };
}

/** Words that say *what kind* of thing is denied, not *what*: "reports of", "claims that". */
const DENIED_FILLER = new Set(["report", "claim", "rumor", "rumour", "story", "allegation", "news", "social", "media", "video", "post", "suggestion"]);

/**
 * Articles that dispute the event itself. Only headline denials count ("officials denied reports of a tsunami"
 * inside a quake story denies a side claim, not the earthquake), and not:
 * - denials of responsibility ("RSF denies involvement", "rejects accusations"): they dispute who did it;
 * - denials of something no other article reports ("operator denies reports of leak after quake"): a side rumour.
 */
function disputingArticles(event: NewsEvent, articles: Map<string, Article>, claims: Map<string, ArticleClaims>): Set<string> {
  const denials = event.articleIds.filter((id) => claims.get(id)?.headlineDenial && !claims.get(id)?.responsibilityDenial);
  if (denials.length === 0) return new Set();
  const reported = new Set<string>();
  for (const id of event.articleIds) {
    if (claims.get(id)?.headlineDenial) continue;
    const article = articles.get(id);
    for (const term of tokenize(`${article?.title ?? ""} ${article?.summary ?? ""}`)) reported.add(term);
  }
  return new Set(denials.filter((id) => {
    const denied = [...new Set(tokenize(claims.get(id)?.deniedText ?? "").filter((t) => !DENIED_FILLER.has(t)))];
    // Nothing specific to compare, or nothing else to compare with: it disputes the event.
    if (denied.length === 0 || reported.size === 0) return true;
    // Most of what is denied must be what the event reports. "Viral video of shark in flooded street is fake"
    // shares only "flood" with a hurricane story: it denies a side claim.
    const overlap = denied.filter((t) => reported.has(t)).length;
    // A denial that brings two or more specifics the story never mentioned ("viral", "shark") is about
    // something else, even when it shares setting words ("flooded Tallahassee street").
    const unmentioned = denied.length - overlap;
    return overlap / denied.length >= 0.5 && unmentioned <= 1;
  }));
}

/**
 * The correction negates the story itself ("…has not been arrested", "…did not resign"), rather than a detail.
 * A correction that still states a figure ("caused no deaths, 20 injured") corrects a detail.
 */
function isCoreRetraction(title: string, claims: ArticleClaims): boolean {
  const negates = /\b(?:not|never|no|didn['’]t|hasn['’]t|wasn['’]t|false|untrue)\b/i.test(title.replace(/^correction:\s*/i, ""));
  const keepsFigures = claims.numbers.some((n) => n.value > 0);
  return negates && !keepsFigures;
}

function statusOf(c: Omit<Verification, "status" | "reason"> & { retracting: boolean }): Verification {
  const base = { confirming: c.confirming, disputing: c.disputing, primary: c.primary, tier1: c.tier1, signals: c.signals, stateMediaOwnCountry: c.stateMediaOwnCountry };
  const sources = (n: number) => `${n} independent source${n === 1 ? "" : "s"}`;

  if (c.retracting) {
    return { ...base, status: "retracted", reason: "A source reported a correction or retraction." };
  }
  if (c.disputing > 0) {
    return { ...base, status: "disputed", reason: `${sources(c.confirming)} report it; ${c.disputing} ${c.disputing === 1 ? "reports a denial or calls" : "report a denial or call"} it false.` };
  }
  if (c.primary > 0) {
    return { ...base, status: "confirmed", reason: `Confirmed by an official source${c.confirming > c.primary ? `, plus ${sources(c.confirming - c.primary)}` : ""}.` };
  }
  if (c.confirming >= 3 || (c.confirming >= 2 && c.tier1 >= 1)) {
    return { ...base, status: "corroborated", reason: `${sources(c.confirming)} report it${c.tier1 ? `, ${c.tier1} with strong editorial standards` : ""}.` };
  }
  if (c.confirming >= 1) {
    return { ...base, status: "reported", reason: c.confirming === 1 ? "Only one independent source so far (others may be copies)." : `${sources(c.confirming)}, none with strong editorial standards yet.` };
  }
  if (c.stateMediaOwnCountry > 0) {
    return { ...base, status: "unverified", reason: "Only state media of the country involved so far. Not independently confirmed." };
  }
  return { ...base, status: "unverified", reason: "Only social media posts so far. Not confirmed by any news or official source." };
}

/** All of the origin's sources are state-funded and from a country the event is about. */
function isOwnCountryStateMedia(origin: EventOrigin, eventText: string, sources: Map<string, NewsSource>): boolean {
  if (origin.kind !== "outlet") return false;
  const originSources = origin.sourceIds.map((id) => sources.get(id)).filter((s): s is NewsSource => s !== undefined);
  return originSources.length > 0 && originSources.every((s) => s.stateFunded && mentionsCountry(eventText, s.country));
}

function summarizeNumbers(
  origins: EventOrigin[],
  articles: Map<string, Article>,
  claims: Map<string, ArticleClaims>,
  sources: Map<string, NewsSource>,
  disputes: Set<string>,
): { summaries: NumberSummary[]; chatterOnly: ChatterOnly[] } {
  const byKind = new Map<CountKind, NumberReport[]>();
  const chatter = new Map<CountKind, Map<number, number>>();
  for (const origin of origins) {
    if (origin.kind === "signal") {
      // Social posts never count toward the figures, but "what number are people talking about" is shown separately.
      for (const articleId of origin.articleIds) {
        for (const n of claims.get(articleId)?.numbers ?? []) {
          const counts = chatter.get(n.kind) ?? new Map<number, number>();
          counts.set(n.value, (counts.get(n.value) ?? 0) + 1);
          chatter.set(n.kind, counts);
        }
      }
      continue;
    }
    for (const articleId of origin.articleIds) {
      const article = articles.get(articleId);
      const articleClaims = claims.get(articleId);
      if (!article || !articleClaims || disputes.has(articleId)) continue;
      const sourceId = article.sourceIds[0] ?? "";
      const fromPrimary = sources.get(sourceId)?.tier === "primary";
      for (const n of articleClaims.numbers) {
        const list = byKind.get(n.kind) ?? [];
        list.push({
          value: n.value,
          qualifier: n.qualifier,
          attribution: fromPrimary ? "official" : n.attribution,
          official: fromPrimary || n.attribution === "official",
          originKey: origin.key,
          sourceId,
          articleId,
          at: article.publishedAt,
        });
        byKind.set(n.kind, list);
      }
    }
  }

  const chatterFor = (kind: CountKind) =>
    [...(chatter.get(kind) ?? new Map<number, number>()).entries()]
      .map(([value, mentions]) => ({ value, mentions }))
      .sort((a, b) => b.mentions - a.mentions || b.value - a.value)
      .slice(0, 3);

  const summaries: NumberSummary[] = [...byKind.entries()].map(([kind, reports]) => {
    reports.sort((a, b) => a.at.localeCompare(b.at));
    // Each origin's latest number: early counts are replaced as that source updates.
    const latestPerOrigin = new Map<string, NumberReport>();
    for (const r of reports) latestPerOrigin.set(r.originKey, r);

    const votes = new Map<number, { origins: number; newest: string }>();
    for (const r of latestPerOrigin.values()) {
      const vote = votes.get(r.value) ?? { origins: 0, newest: r.at };
      vote.origins += 1;
      if (r.at > vote.newest) vote.newest = r.at;
      votes.set(r.value, vote);
    }
    const [mostValue, mostVote] = [...votes.entries()].sort((a, b) => b[1].origins - a[1].origins || b[1].newest.localeCompare(a[1].newest))[0]!;
    const official = reports.filter((r) => r.official).at(-1);
    const values = reports.map((r) => r.value);

    return {
      kind,
      min: Math.min(...values),
      max: Math.max(...values),
      mostReported: { value: mostValue, origins: mostVote.origins },
      latestOfficial: official && { value: official.value, at: official.at, sourceId: official.sourceId },
      timeline: reports,
      chatter: chatterFor(kind),
    };
  });

  // Kinds only social posts mention: no verified figures yet, just chatter.
  const chatterOnly = [...chatter.keys()]
    .filter((kind) => !byKind.has(kind))
    .sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b))
    .map((kind) => ({ kind, values: chatterFor(kind) }));
  return { summaries: summaries.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)), chatterOnly };
}

const KIND_ORDER: CountKind[] = ["killed", "injured", "missing", "arrested", "evacuated", "displaced", "magnitude"];

function summarizeStatements(origins: EventOrigin[], claims: Map<string, ArticleClaims>): StatementSummary[] {
  const bySpeaker = new Map<string, StatementSummary & { seen: Set<string> }>();
  for (const origin of origins) {
    for (const articleId of origin.articleIds) {
      const articleClaims = claims.get(articleId);
      for (const s of articleClaims?.statements ?? []) {
        // In "ministry denies minister said X", the "said" is what is being denied, not a new assertion.
        if (articleClaims?.headlineDenial && s.stance === "asserts") continue;
        const summary = bySpeaker.get(s.speakerKey) ?? { speakerKey: s.speakerKey, speaker: s.speaker, asserts: 0, denies: 0, confirms: 0, seen: new Set() };
        // Count each origin once per speaker and stance.
        const key = `${origin.key}:${s.stance}`;
        if (!summary.seen.has(key)) {
          summary.seen.add(key);
          if (s.stance === "asserts") summary.asserts += 1;
          else if (s.stance === "denies") summary.denies += 1;
          else summary.confirms += 1;
        }
        bySpeaker.set(s.speakerKey, summary);
      }
    }
  }
  return [...bySpeaker.values()]
    .map(({ seen: _seen, ...rest }) => rest)
    .sort((a, b) => b.asserts + b.denies + b.confirms - (a.asserts + a.denies + a.confirms));
}
