import type { Article, NewsSource } from "../sources/types.ts";

/** Wire agencies whose stories are republished by many outlets. A credit means "this is the wire's report". */
const WIRE_CREDITS: { id: string; pattern: RegExp }[] = [
  { id: "reuters", pattern: /\bReuters\b/ },
  { id: "ap", pattern: /\(AP\)|\bAssociated Press\b|\bAP\b\s*[—–-]/ },
  { id: "afp", pattern: /\bAFP\b|Agence France-Presse/ },
  { id: "pa", pattern: /\bPA Media\b|\(PA\)/ },
  { id: "dpa", pattern: /\bdpa\b/ },
  { id: "ani", pattern: /\(ANI\)|\bANI\b\s*[—–-]/ },
  { id: "pti", pattern: /\(PTI\)|\bPTI\b\s*[—–-]/ },
];

export type OriginKind = "primary" | "wire" | "outlet" | "signal";

export interface ArticleOrigin {
  /** Articles with the same origin key are NOT independent of each other. */
  key: string;
  kind: OriginKind;
}

/**
 * Who actually produced this report?
 * - official sources are their own origin (primary);
 * - a wire credit in the headline/summary means the wire is the origin;
 * - otherwise the outlet's owner (all BBC feeds = one origin).
 * Conservative on purpose: "told Reuters" also counts as Reuters, which can only undercount independence.
 */
export function originOf(article: Article, source: NewsSource): ArticleOrigin {
  if (source.tier === "primary") return { key: `primary:${source.owner}`, kind: "primary" };
  if (source.tier === "signal") return { key: `signal:${source.owner}`, kind: "signal" };
  const text = `${article.title} ${article.summary ?? ""}`;
  const wire = WIRE_CREDITS.find((w) => w.pattern.test(text));
  if (wire) return { key: `wire:${wire.id}`, kind: "wire" };
  return { key: `outlet:${source.owner}`, kind: "outlet" };
}
