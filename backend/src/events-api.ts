import type { VerifiedEvent } from "./analysis/verify.ts";
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
  /** Independent origins with their articles, so users can check every source themselves. */
  origins: {
    key: string;
    kind: string;
    tier: string;
    articles: { id: string; title: string; url: string; source_id: string; source_name: string; published_at: string }[];
  }[];
}

export function toApiEvents(events: VerifiedEvent[], articles: Map<string, Article>, sources: Map<string, NewsSource>, now: Date): EventsResponse {
  return {
    generated_at: now.toISOString(),
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      first_seen_at: e.firstSeenAt,
      last_updated_at: e.lastUpdatedAt,
      key_terms: e.keyTerms,
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
