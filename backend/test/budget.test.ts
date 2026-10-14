import assert from "node:assert/strict";
import { test } from "node:test";
import { DailyBudget } from "../src/budget.ts";
import { Clock } from "./helpers.ts";

const prices = { postRead: 0.005, userRead: 0.01 };

test("charges each resource once per UTC day, like X billing dedup", () => {
  const budget = new DailyBudget(0.05, prices, new Clock("2026-10-14T10:00:00Z").now);
  assert.equal(budget.affordable("post"), 10);
  assert.ok(Math.abs(budget.record("post", ["1", "2"]) - 0.01) < 1e-9);
  assert.equal(budget.record("post", ["1", "2"]), 0);
  assert.equal(budget.affordable("post"), 8);
  assert.equal(budget.affordable("user"), 4);
});

test("resets at midnight UTC", () => {
  const clock = new Clock("2026-10-14T23:59:00Z");
  const budget = new DailyBudget(0.05, prices, clock.now);
  budget.record("post", ["1"]);
  clock.advanceMinutes(2);
  assert.equal(budget.spentUsd, 0);
  assert.ok(budget.costOf("post", ["1"]) > 0, "a new day bills the same post again");
});

test("restores today's state but ignores yesterday's", () => {
  const now = new Clock("2026-10-14T12:00:00Z").now;
  const today = new DailyBudget(1, prices, now, { day: "2026-10-14", spentUsd: 0.4, seenPosts: ["9"], seenUsers: [] });
  assert.equal(today.spentUsd, 0.4);
  assert.equal(today.costOf("post", ["9"]), 0);
  const stale = new DailyBudget(1, prices, now, { day: "2026-10-13", spentUsd: 0.9, seenPosts: [], seenUsers: [] });
  assert.equal(stale.spentUsd, 0);
});
