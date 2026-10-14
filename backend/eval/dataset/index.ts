import { createHash } from "node:crypto";
import type { Article } from "../../src/sources/types.ts";
import type { LabeledArticle, LabeledEvent } from "../dsl.ts";
import { disasters } from "./disasters.ts";
import { noise } from "./noise.ts";
import { politics } from "./politics.ts";
import { violence } from "./violence.ts";

export const events: LabeledEvent[] = [...disasters, ...violence, ...politics, ...noise];

export type Split = "train" | "test";

/**
 * ~30% of events are held out. The split is a hash of the event id (not hand-picked), so it doesn't change
 * when events are added elsewhere, and nobody chooses which events are "easy" enough to tune on.
 */
export function splitOf(eventId: string): Split {
  const h = createHash("sha256").update(`split:${eventId}`).digest().readUInt32BE(0);
  return h % 10 < 3 ? "test" : "train";
}

export interface CorpusArticle {
  article: Article;
  label: LabeledArticle;
  event: LabeledEvent;
}

/** All benchmark articles as the engine sees them (one corpus: events compete with each other for articles). */
export function buildCorpus(selected: LabeledEvent[] = events): CorpusArticle[] {
  const seenIds = new Set<string>();
  for (const e of selected) {
    if (seenIds.has(e.id)) throw new Error(`duplicate event id ${e.id}`);
    seenIds.add(e.id);
  }
  return selected.flatMap((event) =>
    event.articles.map((label, i) => {
      const at = new Date(Date.parse(event.start) + label.minutes * 60_000).toISOString();
      const url = `https://${label.source}.eval/${event.id}/${i}`;
      const article: Article = {
        // Opaque id (like the real hash of the URL): the engine must not see the label.
        id: createHash("sha1").update(url).digest("hex").slice(0, 16),
        url,
        title: label.title,
        summary: label.summary,
        publishedAt: at,
        fetchedAt: at,
        language: "en",
        sourceIds: [label.source],
      };
      return { article, label, event };
    }),
  );
}
