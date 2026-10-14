// A tiny labelling language for the benchmark, so hundreds of articles stay readable in review.
//
//   ev("peru-quake", "2026-10-12T03:14Z", "confirmed", [
//     a("usgs-quakes", 0, "M 6.8 - 42 km SW of Arequipa, Peru", "Magnitude 6.8 …", "magnitude 6.8"),
//     a("bbc-world", 50, "Peru earthquake: …", "… at least 5 people were killed, officials said.", "killed >=5 official", "magnitude 6.8"),
//     a("ministry", 90, "Ministry denies …", "", DENIAL),
//   ])
//
// Number labels: "<kind> [>=|>|<=|~]<value> [official|witness|media]" (no prefix = exact, no attribution = unattributed).
//   >= at least · > more than/over · <= up to · ~ about/nearly/some.
// Flags: DENIAL = the headline is a denial ("X denies…", "…is false"); RETRACTION = the headline is a correction/retraction.
// Articles without number labels are expected to yield no numbers: every predicted number must be justified.

import type { AttributionType, CountKind, Qualifier } from "../src/analysis/claims.ts";
import type { VerificationStatus } from "../src/analysis/verify.ts";

export const DENIAL = "DENIAL";
export const RETRACTION = "RETRACTION";

export interface ExpectedNumber {
  kind: CountKind;
  value: number;
  qualifier: Qualifier;
  attribution: AttributionType;
}

export interface LabeledArticle {
  source: string;
  /** Minutes after the event's start. */
  minutes: number;
  title: string;
  summary?: string;
  numbers: ExpectedNumber[];
  headlineDenial: boolean;
  headlineRetraction: boolean;
}

export interface LabeledEvent {
  id: string;
  start: string;
  /** Status the event should have once all its articles are in. */
  status: VerificationStatus;
  articles: LabeledArticle[];
  /** Why this event is in the benchmark (hard negative, copies, …). */
  note?: string;
}

const KINDS = new Set<CountKind>(["killed", "injured", "missing", "arrested", "evacuated", "displaced", "magnitude"]);
const QUALIFIERS: Record<string, Qualifier> = { ">=": "atLeast", ">": "moreThan", "<=": "upTo", "~": "about", "": "exact" };
const ATTRIBUTIONS = new Set<AttributionType>(["official", "witness", "media", "unattributed"]);

export function parseLabel(label: string): ExpectedNumber {
  const m = /^(\w+) (>=|>|<=|~)?(\d+(?:\.\d+)?)(?: (\w+))?$/.exec(label);
  if (!m) throw new Error(`bad number label: "${label}"`);
  const kind = m[1] as CountKind;
  const attribution = (m[4] ?? "unattributed") as AttributionType;
  if (!KINDS.has(kind)) throw new Error(`unknown kind in "${label}"`);
  if (!ATTRIBUTIONS.has(attribution)) throw new Error(`unknown attribution in "${label}"`);
  return { kind, value: Number(m[3]), qualifier: QUALIFIERS[m[2] ?? ""]!, attribution };
}

export function formatNumber(n: { kind: string; value: number; qualifier: Qualifier; attribution: AttributionType }): string {
  const prefix = Object.entries(QUALIFIERS).find(([, q]) => q === n.qualifier)?.[0] ?? "";
  return `${n.kind} ${prefix}${n.value}${n.attribution === "unattributed" ? "" : ` ${n.attribution}`}`;
}

/** One article: source id, minutes after the event start, headline, summary ("" for none), then labels. */
export function a(source: string, minutes: number, title: string, summary: string, ...labels: string[]): LabeledArticle {
  return {
    source,
    minutes,
    title,
    summary: summary || undefined,
    numbers: labels.filter((l) => l !== DENIAL && l !== RETRACTION).map(parseLabel),
    headlineDenial: labels.includes(DENIAL),
    headlineRetraction: labels.includes(RETRACTION),
  };
}

export function ev(id: string, start: string, status: VerificationStatus, articles: LabeledArticle[], note?: string): LabeledEvent {
  return { id, start, status, articles, note };
}
