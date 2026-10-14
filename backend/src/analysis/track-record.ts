import type { VerifiedEvent } from "./verify.ts";

/** How a source's early reports compared with what was later officially established. */
export interface SourceRecord {
  /** Settled events with an official figure that this source reported a number for. */
  numbersChecked: number;
  /** First reported number was within ±10 % of the final official figure. */
  numbersClose: number;
  /** First reported number was higher than the final figure by more than 10 %. */
  numbersHigh: number;
  /** First reported number was lower by more than 10 % (normal for early casualty counts). */
  numbersLow: number;
  /** Settled events that ended up disputed or retracted where this source reported the claim. */
  disputedOrRetracted: number;
  eventsSettled: number;
}

export interface TrackRecordSnapshot {
  sources: Record<string, SourceRecord>;
  evaluatedEventIds: string[];
}

const SETTLE_AFTER_MS = 12 * 3_600_000;
const CLOSE = 0.1;

/**
 * Learns each source's track record from settled events (no new reports for 12 hours).
 * Each event is evaluated once. Used later to weight sources; for now it's exposed so people can see it.
 */
export class TrackRecord {
  readonly sources = new Map<string, SourceRecord>();
  readonly #evaluated = new Set<string>();

  static restore(snapshot: TrackRecordSnapshot): TrackRecord {
    const record = new TrackRecord();
    for (const [id, r] of Object.entries(snapshot.sources)) record.sources.set(id, r);
    for (const id of snapshot.evaluatedEventIds) record.#evaluated.add(id);
    return record;
  }

  snapshot(): TrackRecordSnapshot {
    return { sources: Object.fromEntries(this.sources), evaluatedEventIds: [...this.#evaluated] };
  }

  /** Evaluates newly settled events. Returns how many were evaluated. */
  update(events: VerifiedEvent[], now: Date): number {
    let evaluated = 0;
    for (const event of events) {
      if (this.#evaluated.has(event.id)) continue;
      if (now.getTime() - Date.parse(event.lastUpdatedAt) < SETTLE_AFTER_MS) continue;
      this.#evaluated.add(event.id);
      evaluated += 1;

      const reporting = new Set(event.origins.filter((o) => o.kind !== "signal").flatMap((o) => o.sourceIds));
      for (const sourceId of reporting) this.#record(sourceId).eventsSettled += 1;

      const status = event.verification.status;
      if (status === "disputed" || status === "retracted") {
        for (const sourceId of reporting) this.#record(sourceId).disputedOrRetracted += 1;
        continue;
      }

      for (const summary of event.numbers) {
        if (summary.kind === "magnitude" || !summary.latestOfficial) continue;
        const final = summary.latestOfficial.value;
        const firstBySource = new Map<string, number>();
        for (const report of summary.timeline) {
          if (!firstBySource.has(report.sourceId)) firstBySource.set(report.sourceId, report.value);
        }
        for (const [sourceId, first] of firstBySource) {
          const r = this.#record(sourceId);
          r.numbersChecked += 1;
          const diff = final === 0 ? (first === 0 ? 0 : 1) : (first - final) / final;
          if (Math.abs(diff) <= CLOSE) r.numbersClose += 1;
          else if (diff > 0) r.numbersHigh += 1;
          else r.numbersLow += 1;
        }
      }
    }
    // Forget evaluated ids that no longer exist (articles expire), keeping the set small.
    const alive = new Set(events.map((e) => e.id));
    for (const id of this.#evaluated) if (!alive.has(id)) this.#evaluated.delete(id);
    return evaluated;
  }

  #record(sourceId: string): SourceRecord {
    let r = this.sources.get(sourceId);
    if (!r) {
      r = { numbersChecked: 0, numbersClose: 0, numbersHigh: 0, numbersLow: 0, disputedOrRetracted: 0, eventsSettled: 0 };
      this.sources.set(sourceId, r);
    }
    return r;
  }
}
