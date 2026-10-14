import assert from "node:assert/strict";
import { test } from "node:test";
import { articleLinkOf, canonicalizeUrl } from "../src/news/url.ts";
import { post } from "./helpers.ts";

test("removes tracking parameters, fragments, www and trailing slashes", () => {
  assert.equal(
    canonicalizeUrl("http://www.Reuters.com/world/story-1/?utm_source=x&utm_medium=social&id=7#top"),
    "https://reuters.com/world/story-1?id=7",
  );
  assert.equal(canonicalizeUrl("https://www.bbc.co.uk/news/123/amp"), "https://bbc.co.uk/news/123");
  assert.equal(canonicalizeUrl("not a url"), null);
  assert.equal(canonicalizeUrl("ftp://example.com/file"), null);
});

test("picks the first non-X link as the article", () => {
  const p = post("1", "u1", "https://example.com/a");
  p.entities = {
    urls: [
      { start: 0, end: 1, url: "https://t.co/a", expanded_url: "https://x.com/someone/status/5" },
      { start: 2, end: 3, url: "https://t.co/b", expanded_url: "https://news.test/b?utm_campaign=z", title: "Headline" },
    ],
  };
  assert.deepEqual(articleLinkOf(p), { url: "https://news.test/b", title: "Headline", description: undefined, imageUrl: undefined });
});

test("ignores posts without article links", () => {
  assert.equal(articleLinkOf({ id: "1", text: "no links" }), null);
});
