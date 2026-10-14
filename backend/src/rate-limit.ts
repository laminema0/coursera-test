import type { IncomingMessage } from "node:http";

/** Fixed-window request limit per client. Small and in-memory: enough to protect a free VM from abuse. */
export class RateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #now: () => number;
  #windowStart = 0;
  #counts = new Map<string, number>();

  constructor(limitPerWindow = 120, windowMs = 60_000, now: () => number = Date.now) {
    this.#limit = limitPerWindow;
    this.#windowMs = windowMs;
    this.#now = now;
  }

  /** Returns seconds to wait if the client is over the limit, otherwise undefined. */
  check(client: string): number | undefined {
    const now = this.#now();
    if (now - this.#windowStart >= this.#windowMs) {
      this.#windowStart = now;
      this.#counts = new Map();
    }
    const count = (this.#counts.get(client) ?? 0) + 1;
    this.#counts.set(client, count);
    return count > this.#limit ? Math.ceil((this.#windowStart + this.#windowMs - now) / 1000) : undefined;
  }
}

/**
 * Client address. Behind Cloudflare Tunnel all requests come from localhost, so the CF-Connecting-IP header
 * is trusted only then; a direct client can't spoof it.
 */
export function clientOf(request: IncomingMessage): string {
  const remote = request.socket.remoteAddress ?? "unknown";
  const loopback = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
  const forwarded = request.headers["cf-connecting-ip"];
  return loopback && typeof forwarded === "string" && forwarded ? forwarded : remote;
}
