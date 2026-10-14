import { type ArticleClaims, type CountKind, extractClaims, type NumberClaim } from "../src/analysis/claims.ts";
import { type ClusterOptions, defaultClusterOptions, eventsFromGroups } from "../src/analysis/cluster.ts";
import { analyze, type VerificationStatus, type VerifiedEvent, verifyEvent } from "../src/analysis/verify.ts";
import type { Article, NewsSource } from "../src/sources/types.ts";
import { type CorpusArticle, type Split, splitOf } from "./dataset/index.ts";
import { type ExpectedNumber, formatNumber } from "./dsl.ts";

export const STATUSES: VerificationStatus[] = ["unverified", "reported", "corroborated", "confirmed", "disputed", "retracted"];
export const KINDS: CountKind[] = ["killed", "injured", "missing", "arrested", "evacuated", "displaced", "magnitude"];

export interface ClusterReport {
  precision: number;
  recall: number;
  f1: number;
  goldEvents: number;
  predictedEvents: number;
  /** Predicted events mixing articles of several true events. */
  merged: { title: string; parts: { event: string; articles: number }[] }[];
  /** True events spread over several predicted events. */
  split: { event: string; parts: { title: string; articles: number }[] }[];
}

export interface PRF {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface ClaimReport {
  perKind: Record<string, PRF>;
  overall: PRF;
  qualifierAccuracy: { correct: number; total: number };
  attributionAccuracy: { correct: number; total: number };
  denial: PRF;
  retraction: PRF;
  falsePositives: { event: string; title: string; got: string }[];
  falseNegatives: { event: string; title: string; expected: string; got: string[] }[];
  wrongAttribution: { event: string; title: string; expected: string; got: string }[];
  flagErrors: { event: string; title: string; flag: string; expected: boolean }[];
}

export interface StatusReport {
  /** Status of the predicted event holding most of each true event's articles. */
  accuracy: { correct: number; total: number };
  confusion: Record<string, Record<string, number>>;
  /** Status computed on the true grouping: isolates status rules from grouping mistakes. */
  oracleAccuracy: { correct: number; total: number };
  oracleConfusion: Record<string, Record<string, number>>;
  wrong: { event: string; expected: VerificationStatus; got: VerificationStatus; oracle: VerificationStatus; reason: string }[];
}

export interface SplitReport {
  split: Split | "all";
  events: number;
  articles: number;
  clusters: ClusterReport;
  claims: ClaimReport;
  status: StatusReport;
}

export interface Evaluation {
  bySplit: Record<Split | "all", SplitReport>;
  analyzeMs: number;
}

/** Runs the whole engine once on the full corpus (all events compete), then scores each split. */
export function evaluate(corpus: CorpusArticle[], sources: Map<string, NewsSource>, options: ClusterOptions = defaultClusterOptions): Evaluation {
  const articles = corpus.map((c) => c.article);
  const started = performance.now();
  const predicted = analyze(articles, sources, options);
  const analyzeMs = performance.now() - started;

  const claims = new Map(articles.map((a) => [a.id, extractClaims(a.title, a.summary)]));
  const articleById = new Map(articles.map((a) => [a.id, a]));
  const goldGroups = groupBy(corpus, (c) => c.event.id);
  const oracleEvents = eventsFromGroups(articles, [...goldGroups.values()].map((g) => g.map((c) => c.article.id)), sources, options)
    .map((e) => verifyEvent(e, articleById, claims, sources));

  const report = (split: Split | "all"): SplitReport => {
    const selected = corpus.filter((c) => split === "all" || splitOf(c.event.id) === split);
    return {
      split,
      events: new Set(selected.map((c) => c.event.id)).size,
      articles: selected.length,
      clusters: clusterReport(selected, corpus, predicted),
      claims: claimReport(selected, claims),
      status: statusReport(selected, predicted, oracleEvents),
    };
  };
  return { bySplit: { train: report("train"), test: report("test"), all: report("all") }, analyzeMs };
}

function clusterReport(selected: CorpusArticle[], corpus: CorpusArticle[], predicted: VerifiedEvent[]): ClusterReport {
  const goldOf = new Map(corpus.map((c) => [c.article.id, c.event.id]));
  const goldSize = countBy(corpus, (c) => c.event.id);
  const predictedOf = new Map<string, VerifiedEvent>();
  for (const e of predicted) for (const id of e.articleIds) predictedOf.set(id, e);

  // B-cubed: per article, how pure is its predicted event (precision) and how complete (recall).
  let p = 0;
  let r = 0;
  for (const c of selected) {
    const event = predictedOf.get(c.article.id);
    const gold = c.event.id;
    const members = event?.articleIds ?? [c.article.id];
    const same = members.filter((id) => goldOf.get(id) === gold).length;
    p += same / members.length;
    r += same / goldSize.get(gold)!;
  }
  const precision = p / selected.length;
  const recall = r / selected.length;

  const selectedGold = new Set(selected.map((c) => c.event.id));
  const touched = predicted.filter((e) => e.articleIds.some((id) => selectedGold.has(goldOf.get(id)!)));
  const merged = touched
    .map((e) => ({ title: e.title, parts: [...countBy(e.articleIds, (id) => goldOf.get(id)!)].map(([event, articles]) => ({ event, articles })) }))
    .filter((m) => m.parts.length > 1)
    .sort((a, b) => b.parts.length - a.parts.length);
  const split = [...selectedGold]
    .map((event) => {
      const parts = countBy(corpus.filter((c) => c.event.id === event), (c) => predictedOf.get(c.article.id)!);
      return { event, parts: [...parts].map(([e, articles]) => ({ title: e.title, articles })) };
    })
    .filter((s) => s.parts.length > 1)
    .sort((a, b) => b.parts.length - a.parts.length);

  return { precision, recall, f1: f1(precision, recall), goldEvents: selectedGold.size, predictedEvents: touched.length, merged, split };
}

function claimReport(selected: CorpusArticle[], claims: Map<string, ArticleClaims>): ClaimReport {
  const counts = new Map<string, { tp: number; fp: number; fn: number }>(KINDS.map((k) => [k, { tp: 0, fp: 0, fn: 0 }]));
  const report: Omit<ClaimReport, "perKind" | "overall" | "denial" | "retraction"> = {
    qualifierAccuracy: { correct: 0, total: 0 },
    attributionAccuracy: { correct: 0, total: 0 },
    falsePositives: [],
    falseNegatives: [],
    wrongAttribution: [],
    flagErrors: [],
  };
  const denial = { tp: 0, fp: 0, fn: 0 };
  const retraction = { tp: 0, fp: 0, fn: 0 };

  for (const c of selected) {
    const got = claims.get(c.article.id)!;
    const remaining = [...got.numbers];
    for (const expected of c.label.numbers) {
      const k = counts.get(expected.kind)!;
      const i = remaining.findIndex((n) => n.kind === expected.kind && n.value === expected.value);
      if (i < 0) {
        k.fn += 1;
        report.falseNegatives.push({ event: c.event.id, title: c.article.title, expected: formatNumber(expected), got: got.numbers.map(formatNumber) });
        continue;
      }
      const [match] = remaining.splice(i, 1) as [NumberClaim];
      k.tp += 1;
      tally(report.qualifierAccuracy, match.qualifier === expected.qualifier);
      tally(report.attributionAccuracy, match.attribution === expected.attribution);
      if (match.attribution !== expected.attribution) {
        report.wrongAttribution.push({ event: c.event.id, title: c.article.title, expected: formatNumber(expected), got: formatNumber(match) });
      }
    }
    for (const extra of remaining) {
      counts.get(extra.kind)!.fp += 1;
      report.falsePositives.push({ event: c.event.id, title: c.article.title, got: formatNumber(extra) });
    }
    flag(denial, got.headlineDenial, c.label.headlineDenial, () => report.flagErrors.push({ event: c.event.id, title: c.article.title, flag: "denial", expected: c.label.headlineDenial }));
    flag(retraction, got.headlineRetraction, c.label.headlineRetraction, () => report.flagErrors.push({ event: c.event.id, title: c.article.title, flag: "retraction", expected: c.label.headlineRetraction }));
  }

  const perKind = Object.fromEntries([...counts].map(([kind, n]) => [kind, prf(n)]));
  const total = [...counts.values()].reduce((s, n) => ({ tp: s.tp + n.tp, fp: s.fp + n.fp, fn: s.fn + n.fn }), { tp: 0, fp: 0, fn: 0 });
  return { ...report, perKind, overall: prf(total), denial: prf(denial), retraction: prf(retraction) };
}

function statusReport(selected: CorpusArticle[], predicted: VerifiedEvent[], oracle: VerifiedEvent[]): StatusReport {
  const report: StatusReport = {
    accuracy: { correct: 0, total: 0 },
    confusion: emptyConfusion(),
    oracleAccuracy: { correct: 0, total: 0 },
    oracleConfusion: emptyConfusion(),
    wrong: [],
  };
  const predictedOf = new Map<string, VerifiedEvent>();
  for (const e of predicted) for (const id of e.articleIds) predictedOf.set(id, e);
  const oracleOf = new Map<string, VerifiedEvent>();
  for (const e of oracle) for (const id of e.articleIds) oracleOf.set(id, e);

  for (const [eventId, members] of groupBy(selected, (c) => c.event.id)) {
    const expected = members[0]!.event.status;
    // The predicted event holding most of this event's articles is what a reader would see.
    const [main] = [...countBy(members, (c) => predictedOf.get(c.article.id)!)].sort((a, b) => b[1] - a[1])[0]!;
    const got = main.verification.status;
    const oracleStatus = oracleOf.get(members[0]!.article.id)!.verification.status;
    tally(report.accuracy, got === expected);
    tally(report.oracleAccuracy, oracleStatus === expected);
    report.confusion[expected]![got]! += 1;
    report.oracleConfusion[expected]![oracleStatus]! += 1;
    if (got !== expected) report.wrong.push({ event: eventId, expected, got, oracle: oracleStatus, reason: main.verification.reason });
  }
  return report;
}

function emptyConfusion(): Record<string, Record<string, number>> {
  return Object.fromEntries(STATUSES.map((s) => [s, Object.fromEntries(STATUSES.map((t) => [t, 0]))]));
}

function flag(n: { tp: number; fp: number; fn: number }, got: boolean, expected: boolean, onError: () => void): void {
  if (got && expected) n.tp += 1;
  else if (got) n.fp += 1;
  else if (expected) n.fn += 1;
  if (got !== expected) onError();
}

function tally(t: { correct: number; total: number }, ok: boolean): void {
  t.total += 1;
  if (ok) t.correct += 1;
}

export function prf(n: { tp: number; fp: number; fn: number }): PRF {
  const precision = n.tp + n.fp === 0 ? 1 : n.tp / (n.tp + n.fp);
  const recall = n.tp + n.fn === 0 ? 1 : n.tp / (n.tp + n.fn);
  return { ...n, precision, recall, f1: f1(precision, recall) };
}

function f1(p: number, r: number): number {
  return p + r === 0 ? 0 : (2 * p * r) / (p + r);
}

function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function countBy<T, K>(items: T[], key: (t: T) => K): Map<K, number> {
  const map = new Map<K, number>();
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1);
  return map;
}

