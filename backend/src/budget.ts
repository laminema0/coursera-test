import type { Prices } from "./config.ts";

export type ReadKind = "post" | "user";

export interface BudgetState {
  day: string;
  spentUsd: number;
  seenPosts: string[];
  seenUsers: string[];
}

/**
 * Hard daily spend limit for the X API, reset at 00:00 UTC.
 * Mirrors X's billing dedup: a resource read again in the same UTC day is not charged again.
 * (X calls dedup a "soft guarantee", so keep the limit a little below what you can afford.)
 */
export class DailyBudget {
  readonly limitUsd: number;
  readonly #prices: Prices;
  readonly #now: () => Date;
  #day: string;
  #spent = 0;
  #seen: Record<ReadKind, Set<string>> = { post: new Set(), user: new Set() };

  constructor(limitUsd: number, prices: Prices, now: () => Date = () => new Date(), state?: BudgetState) {
    this.limitUsd = limitUsd;
    this.#prices = prices;
    this.#now = now;
    this.#day = utcDay(now());
    if (state && state.day === this.#day) {
      this.#spent = state.spentUsd;
      this.#seen = { post: new Set(state.seenPosts), user: new Set(state.seenUsers) };
    }
  }

  price(kind: ReadKind): number {
    return kind === "post" ? this.#prices.postRead : this.#prices.userRead;
  }

  get spentUsd(): number {
    this.#rollOver();
    return this.#spent;
  }

  get remainingUsd(): number {
    return Math.max(0, this.limitUsd - this.spentUsd);
  }

  /** How many not-yet-seen resources of `kind` we can still pay for today. */
  affordable(kind: ReadKind): number {
    return Math.floor(this.remainingUsd / this.price(kind) + 1e-9);
  }

  /** Cost of reading these ids now (ids already read today are free). */
  costOf(kind: ReadKind, ids: string[]): number {
    this.#rollOver();
    const fresh = new Set(ids.filter((id) => !this.#seen[kind].has(id)));
    return fresh.size * this.price(kind);
  }

  /** Records resources the API actually returned. Returns the cost charged. */
  record(kind: ReadKind, ids: string[]): number {
    const cost = this.costOf(kind, ids);
    for (const id of ids) this.#seen[kind].add(id);
    this.#spent += cost;
    return cost;
  }

  state(): BudgetState {
    this.#rollOver();
    return { day: this.#day, spentUsd: this.#spent, seenPosts: [...this.#seen.post], seenUsers: [...this.#seen.user] };
  }

  #rollOver(): void {
    const today = utcDay(this.#now());
    if (today !== this.#day) {
      this.#day = today;
      this.#spent = 0;
      this.#seen = { post: new Set(), user: new Set() };
    }
  }
}

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
