import { createHash } from "node:crypto";
import type { XPost } from "../x/types.ts";

const TRACKING_PARAMS = [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^mc_(cid|eid)$/i, /^cmpid$/i, /^ref(_src|_url)?$/i, /^smid$/i, /^s$/i, /^taid$/i];
const X_HOSTS = new Set(["x.com", "twitter.com", "t.co", "mobile.twitter.com", "pic.twitter.com", "pic.x.com"]);

/** Normalizes an article URL so the same story shared with different tracking links maps to one key. */
export function canonicalizeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase().replace(/^(www|amp|m)\./, "");
  url.hash = "";
  url.port = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((pattern) => pattern.test(key))) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "").replace(/\/amp$/, "");
  return url.toString();
}

export function isXUrl(raw: string): boolean {
  try {
    return X_HOSTS.has(new URL(raw).hostname.toLowerCase().replace(/^www\./, ""));
  } catch {
    return false;
  }
}

export interface ArticleLink {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
}

/** Finds the first link in a post that points outside X: the article the post is about. */
export function articleLinkOf(post: XPost): ArticleLink | null {
  for (const entity of post.entities?.urls ?? []) {
    const target = entity.unwound_url ?? entity.expanded_url;
    if (!target || isXUrl(target)) continue;
    const url = canonicalizeUrl(target);
    if (!url) continue;
    return {
      url,
      title: entity.title || undefined,
      description: entity.description || undefined,
      imageUrl: entity.images?.[0]?.url,
    };
  }
  return null;
}

export function storyIdFor(canonicalUrl: string): string {
  return createHash("sha256").update(canonicalUrl).digest("hex").slice(0, 16);
}

export function publisherOf(canonicalUrl: string): string {
  return new URL(canonicalUrl).hostname;
}
