import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import { test } from "node:test";
import { clientOf, RateLimiter } from "../src/rate-limit.ts";

test("limits each client per window and resets", () => {
  let now = 0;
  const limiter = new RateLimiter(2, 60_000, () => now);
  assert.equal(limiter.check("a"), undefined);
  assert.equal(limiter.check("a"), undefined);
  assert.equal(limiter.check("a"), 60);
  assert.equal(limiter.check("b"), undefined, "other clients unaffected");
  now = 60_000;
  assert.equal(limiter.check("a"), undefined, "new window");
});

test("trusts Cloudflare's client header only for local (tunnel) connections", () => {
  const request = (remoteAddress: string, cf?: string) =>
    ({ socket: { remoteAddress }, headers: cf ? { "cf-connecting-ip": cf } : {} }) as unknown as IncomingMessage;
  assert.equal(clientOf(request("127.0.0.1", "203.0.113.9")), "203.0.113.9");
  assert.equal(clientOf(request("198.51.100.7", "203.0.113.9")), "198.51.100.7", "spoofed header ignored");
  assert.equal(clientOf(request("::1")), "::1");
});
