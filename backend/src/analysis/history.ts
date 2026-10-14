import type { VerificationStatus, VerifiedEvent } from "./verify.ts";

export interface StatusChange {
  status: VerificationStatus;
  /** When this status was first observed. */
  at: string;
  confirming: number;
}

export type HistorySnapshot = Record<string, StatusChange[]>;

/**
 * Remembers how each event's status changed over time (⚪ → 🟡 → 🟢 → ✅ …).
 * Recorded each analysis cycle; only changes are stored.
 */
export class StatusHistory {
  readonly #byEvent = new Map<string, StatusChange[]>();

  static restore(snapshot: HistorySnapshot): StatusHistory {
    const history = new StatusHistory();
    for (const [id, changes] of Object.entries(snapshot)) history.#byEvent.set(id, changes);
    return history;
  }

  snapshot(): HistorySnapshot {
    return Object.fromEntries(this.#byEvent);
  }

  get(eventId: string): StatusChange[] {
    return this.#byEvent.get(eventId) ?? [];
  }

  /** Records new statuses. Returns true if anything changed. Forgets events that no longer exist. */
  record(events: VerifiedEvent[], now: Date): boolean {
    let changed = false;
    const alive = new Set<string>();
    for (const event of events) {
      alive.add(event.id);
      const changes = this.#byEvent.get(event.id) ?? [];
      const last = changes.at(-1);
      if (!last || last.status !== event.verification.status) {
        // The first observation is dated by the event's first report, not by when we happened to analyze it.
        const at = last ? now.toISOString() : event.firstSeenAt;
        changes.push({ status: event.verification.status, at, confirming: event.verification.confirming });
        this.#byEvent.set(event.id, changes);
        changed = true;
      }
    }
    for (const id of this.#byEvent.keys()) {
      if (!alive.has(id)) {
        this.#byEvent.delete(id);
        changed = true;
      }
    }
    return changed;
  }
}
