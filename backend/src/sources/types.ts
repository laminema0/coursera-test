/** 1 = strong editorial and corrections standards; 2 = other national/regional outlets;
 *  primary = official origin of claims; signal = early chatter that never confirms anything alone. */
export type SourceTier = 1 | 2 | "primary" | "signal";

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  format: "rss" | "usgs-geojson";
  tier: SourceTier;
  /** Sources with the same owner are not independent of each other. */
  owner: string;
  country: string;
  pollMinutes: number;
  stateFunded?: boolean;
}

export interface SourceList {
  language: string;
  sources: NewsSource[];
}

/** One item from a feed: headline, short summary and link. We never store article body text. */
export interface Article {
  /** Hash of the canonical URL. */
  id: string;
  url: string;
  title: string;
  summary?: string;
  publishedAt: string;
  fetchedAt: string;
  language: string;
  /** Feeds this article appeared in (same article can be in several feeds of one publisher). */
  sourceIds: string[];
}

/** What a parser extracts from one feed entry, before normalization. */
export interface FeedEntry {
  url: string;
  title: string;
  summary?: string;
  publishedAt?: string;
}
