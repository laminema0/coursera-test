import { XMLParser } from "fast-xml-parser";
import { decodeEntities } from "../news/opengraph.ts";
import type { FeedEntry, NewsSource } from "./types.ts";

const SUMMARY_MAX = 300;

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => name === "item" || name === "entry",
});

/** Parses RSS 2.0, RSS 1.0 (RDF) and Atom into entries. Unknown formats return []. */
export function parseFeed(body: string): FeedEntry[] {
  const doc = xml.parse(body) as Record<string, any>;
  const rssItems = doc.rss?.channel?.item ?? doc["rdf:RDF"]?.item;
  if (Array.isArray(rssItems)) {
    return rssItems.map((item: Record<string, unknown>) => ({
      url: text(item.link) || text(item.guid),
      title: plain(text(item.title)),
      summary: summarize(text(item.description)),
      publishedAt: date(text(item.pubDate) || text(item["dc:date"])),
    })).filter(valid);
  }
  const atomEntries = doc.feed?.entry;
  if (Array.isArray(atomEntries)) {
    return atomEntries.map((entry: Record<string, unknown>) => ({
      url: atomLink(entry.link),
      title: plain(text(entry.title)),
      summary: summarize(text(entry.summary) || text(entry.content)),
      publishedAt: date(text(entry.published) || text(entry.updated)),
    })).filter(valid);
  }
  return [];
}

/** USGS earthquake GeoJSON feed: an official, machine-readable primary source. */
export function parseUsgsGeoJson(body: string): FeedEntry[] {
  const doc = JSON.parse(body) as {
    features?: { properties?: { title?: string; place?: string; mag?: number; time?: number; url?: string; alert?: string | null; tsunami?: number } }[];
  };
  return (doc.features ?? []).flatMap(({ properties: p }) => {
    if (!p?.url || !p.title) return [];
    const details = [
      p.mag !== undefined ? `Magnitude ${p.mag}` : undefined,
      p.place,
      p.alert ? `PAGER alert: ${p.alert}` : undefined,
      p.tsunami ? "Tsunami flag set" : undefined,
    ].filter(Boolean);
    // "M 6.1 - 20 km S of Town" → "M 6.1 earthquake – 20 km S of Town": reads (and matches) like a headline.
    const title = p.mag !== undefined && p.place ? `M ${p.mag} earthquake – ${p.place}` : p.title;
    return [{
      url: p.url,
      title,
      summary: details.join(" · ") || undefined,
      publishedAt: p.time ? new Date(p.time).toISOString() : undefined,
    }];
  });
}

function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === "object") {
    const node = value as Record<string, unknown>;
    return text(node["#text"] ?? node["@_href"] ?? "");
  }
  return "";
}

function atomLink(value: unknown): string {
  const links = (Array.isArray(value) ? value : [value]) as Record<string, string>[];
  const alternate = links.find((l) => l && (l["@_rel"] === undefined || l["@_rel"] === "alternate"));
  return alternate?.["@_href"] ?? text(value);
}

/** Strips HTML and entities, collapses whitespace. */
function plain(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Short summary only: feeds sometimes put the whole article in the description. */
function summarize(html: string): string | undefined {
  const value = plain(html);
  if (!value) return undefined;
  if (value.length <= SUMMARY_MAX) return value;
  const cut = value.slice(0, SUMMARY_MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), SUMMARY_MAX - 40))}…`;
}

function date(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function valid(entry: FeedEntry): boolean {
  return entry.url.startsWith("http") && entry.title.length > 0;
}

/** Picks the parser for a source's format. */
export function parseSource(source: Pick<NewsSource, "format">, body: string): FeedEntry[] {
  switch (source.format) {
    case "usgs-geojson": return parseUsgsGeoJson(body);
    case "bluesky": return parseBlueskyFeed(body);
    default: return parseFeed(body);
  }
}

interface BlueskyFeedItem {
  post?: {
    uri?: string;
    author?: { handle?: string };
    record?: { text?: string; createdAt?: string };
    embed?: { external?: { uri?: string; title?: string; description?: string } };
  };
  /** Present for reposts; we only want the account's own posts. */
  reason?: unknown;
}

/**
 * Bluesky app.bsky.feed.getAuthorFeed response. News accounts post a link card for each story:
 * the card's URL, title and description become the article; posts without a link card use the post itself.
 */
export function parseBlueskyFeed(body: string): FeedEntry[] {
  const doc = JSON.parse(body) as { feed?: BlueskyFeedItem[] };
  return (doc.feed ?? []).flatMap((item) => {
    const post = item.post;
    if (item.reason || !post?.uri || !post.record) return [];
    const external = post.embed?.external;
    const text = plain(post.record.text ?? "");
    const rkey = post.uri.split("/").at(-1);
    const postUrl = post.author?.handle && rkey ? `https://bsky.app/profile/${post.author.handle}/post/${rkey}` : "";
    const title = plain(external?.title ?? "") || text.split(/(?<=[.!?])\s|\n/)[0] || "";
    const entry: FeedEntry = {
      url: external?.uri ?? postUrl,
      title,
      summary: summarize(external?.description || (external ? text : text.slice(title.length))),
      publishedAt: date(post.record.createdAt ?? ""),
    };
    return valid(entry) ? [entry] : [];
  });
}
