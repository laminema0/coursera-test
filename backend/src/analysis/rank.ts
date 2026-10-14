import type { Article } from "../sources/types.ts";
import type { VerifiedEvent } from "./verify.ts";

export interface Ranking {
  /** Higher = more important right now. Only meaningful for sorting. */
  importance: number;
  /** Developing story: first seen in the last 6 hours and still gaining sources or carrying official/casualty news. */
  breaking: boolean;
  /** Independent origins whose first report on this event is from the last hour. */
  newOriginsLastHour: number;
}

const HOUR = 3_600_000;

export function rankEvent(event: VerifiedEvent, articles: Map<string, Article>, now: Date): Ranking {
  const t = now.getTime();
  const v = event.verification;

  const firstByOrigin = event.origins
    .filter((o) => o.kind !== "signal")
    .map((o) => Math.min(...o.articleIds.map((id) => Date.parse(articles.get(id)?.publishedAt ?? event.lastUpdatedAt))));
  const newOriginsLastHour = firstByOrigin.filter((at) => t - at < HOUR).length;

  const hasCasualties = event.numbers.some((n) => n.kind === "killed" || n.kind === "injured" || n.kind === "missing");
  const hoursSinceUpdate = Math.max(0, (t - Date.parse(event.lastUpdatedAt)) / HOUR);
  const hoursSinceFirst = Math.max(0, (t - Date.parse(event.firstSeenAt)) / HOUR);

  const importance =
    2 * Math.log2(1 + v.confirming) +
    0.3 * Math.min(v.signals, 3) +
    1.0 * newOriginsLastHour +
    (hasCasualties ? 1.5 : 0) +
    (v.primary > 0 ? 1 : 0) +
    3 * Math.exp(-hoursSinceUpdate / 6);

  const breaking = hoursSinceFirst <= 6 && (newOriginsLastHour >= 2 || v.primary > 0 || (hasCasualties && v.confirming >= 2));

  return { importance: Number(importance.toFixed(3)), breaking, newOriginsLastHour };
}
