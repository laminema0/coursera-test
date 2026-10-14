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
 * Client address. Behind Cloudflare Tunnel all requests come from the tunnel process, so the CF-Connecting-IP header
 * (or X-Forwarded-For) is trusted only from there; a direct client can't spoof it.
 * `trust`: "loopback" (cloudflared on the same host, default), "private" (cloudflared in another container on a
 * private network, e.g. docker compose) or "none".
 */
export function clientOf(request: IncomingMessage, trust: "loopback" | "private" | "none" = "loopback"): string {
  const remote = request.socket.remoteAddress ?? "unknown";
  const trusted = trust === "loopback" ? isLoopback(remote) : trust === "private" ? isPrivate(remote) : false;
  if (!trusted) return remote;
  const cf = request.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf) return cf.trim();
  const xff = request.headers["x-forwarded-for"];
  const first = typeof xff === "string" ? xff.split(",")[0]?.trim() : undefined;
  return first || remote;
}

export function isLoopback(address: string): boolean {
  return address === "::1" || /^(::ffff:)?127\./.test(address);
}

/** Loopback, RFC 1918, link-local and IPv6 unique-local addresses. */
export function isPrivate(address: string): boolean {
  if (isLoopback(address)) return true;
  const v4 = address.replace(/^::ffff:/, "");
  const m = v4.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  return /^f[cd][0-9a-f]{2}:/i.test(address) || /^fe80:/i.test(address);
}
