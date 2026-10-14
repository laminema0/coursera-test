import assert from "node:assert/strict";
import { test } from "node:test";
import { buildQueries, NEWS_FILTER } from "../src/x/query.ts";

test("combines accounts into one query with the news filter", () => {
  assert.deepEqual(buildQueries(["Reuters", "@AP", "AP"], 512), [`(from:Reuters OR from:AP) ${NEWS_FILTER}`]);
});

test("splits into several queries that each respect the length limit", () => {
  const accounts = Array.from({ length: 60 }, (_, i) => `account_${i}`);
  const queries = buildQueries(accounts, 200);
  assert.ok(queries.length > 1);
  for (const q of queries) assert.ok(q.length <= 200, q);
  const covered = queries.flatMap((q) => [...q.matchAll(/from:(\w+)/g)].map((m) => m[1]));
  assert.deepEqual(covered, accounts);
});
