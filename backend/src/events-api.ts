import { rankEvent } from "./analysis/rank.ts";
import type { VerifiedEvent } from "./analysis/verify.ts";
import type { Coverage } from "./sources/gdelt.ts";
import type { Article, NewsSource } from "./sources/types.ts";

// JSON shape of GET /v1/events (snake_case for the iOS decoder).

export interface EventsResponse {
  generated_at: string;
  events: ApiEvent[];
}

export interface ApiEvent {
  id: string;
  title: string;
  first_seen_at: string;
  last_updated_at: string;
  key_terms: string[];
  importance: number;
  breaking: boolean;
  new_origins_last_hour: number;
  first_report?: { source_id: string; source_name: string; at: string };
  verification: {
    status: string;
    reason: string;
    confirming: number;
    disputing: number;
    primary: number;
    tier1: number;
    signals: number;
    state_media_own_country: number;
  };
  numbers: {
    kind: string;
    min: number;
    max: number;
    most_reported: { value: number; origins: number };
    latest_official?: { value: number; at: string; source_id: string };
    timeline: { value: number; qualifier: string; attribution: string; official: boolean; source_id: string; at: string }[];
  }[];
  statements: { speaker: string; asserts: number; denies: number; confirms: number }[];
  /** Worldwide coverage from GDELT (uncurated outlets): how far the story has spread, not confirmation. */
  coverage?: { outlets: number; countries: number; first_seen_at?: string; checked_at: string };
  /** Independent origins with their articles, so users can check every source themselves. */
  origins: {
    key: string;
    kind: string;
    tier: string;
    articles: { id: string; title: string; url: string; source_id: string; source_name: string; published_at: string }[];
  }[];
}

export function toApiEvents(
  events: VerifiedEvent[],
  articles: Map<string, Article>,
  sources: Map<string, NewsSource>,
  now: Date,
  coverageOf: (eventId: string) => Coverage | undefined = () => undefined,
): EventsResponse {
  return {
    generated_at: now.toISOString(),
    events: events.map((e) => ({ e, rank: rankEvent(e, articles, now) })).map(({ e, rank }) => ({
      id: e.id,
      title: e.title,
      first_seen_at: e.firstSeenAt,
      last_updated_at: e.lastUpdatedAt,
      key_terms: e.keyTerms,
      importance: rank.importance,
      breaking: rank.breaking,
      new_origins_last_hour: rank.newOriginsLastHour,
      first_report: e.firstReport && {
        source_id: e.firstReport.sourceId,
        source_name: sources.get(e.firstReport.sourceId)?.name ?? e.firstReport.sourceId,
        at: e.firstReport.at,
      },
      verification: {
        status: e.verification.status,
        reason: e.verification.reason,
        confirming: e.verification.confirming,
        disputing: e.verification.disputing,
        primary: e.verification.primary,
        tier1: e.verification.tier1,
        signals: e.verification.signals,
        state_media_own_country: e.verification.stateMediaOwnCountry,
      },
      numbers: e.numbers.map((n) => ({
        kind: n.kind,
        min: n.min,
        max: n.max,
        most_reported: n.mostReported,
        latest_official: n.latestOfficial && { value: n.latestOfficial.value, at: n.latestOfficial.at, source_id: n.latestOfficial.sourceId },
        timeline: n.timeline.map((r) => ({ value: r.value, qualifier: r.qualifier, attribution: r.attribution, official: r.official, source_id: r.sourceId, at: r.at })),
      })),
      statements: e.statements.map((s) => ({ speaker: s.speaker, asserts: s.asserts, denies: s.denies, confirms: s.confirms })),
      coverage: (() => {
        const c = coverageOf(e.id);
        return c && { outlets: c.outlets, countries: c.countries, first_seen_at: c.firstSeenAt, checked_at: c.checkedAt };
      })(),
      origins: e.origins.map((o) => ({
        key: o.key,
        kind: o.kind,
        tier: String(o.tier),
        articles: o.articleIds.flatMap((id) => {
          const a = articles.get(id);
          if (!a) return [];
          const sourceId = a.sourceIds[0] ?? "";
          return [{ id: a.id, title: a.title, url: a.url, source_id: sourceId, source_name: sources.get(sourceId)?.name ?? sourceId, published_at: a.publishedAt }];
        }),
      })),
    })),
  };
}
