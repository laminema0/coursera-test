import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePageMetadata } from "../src/news/opengraph.ts";

test("reads Open Graph tags in any attribute order and decodes entities", () => {
  const html = `<html><head>
    <title>Fallback title</title>
    <meta content="Markets &amp; rates" property="og:title">
    <meta property='og:description' content='Central bank holds &#39;steady&#39;'>
    <meta name="twitter:image" content="/img/lead.jpg">
    <link rel="canonical" href="https://news.test/markets/rates">
  </head><body><meta property="og:title" content="ignored body tag"></body></html>`;

  assert.deepEqual(parsePageMetadata(html, "https://news.test/markets/rates?utm_source=x"), {
    title: "Markets & rates",
    description: "Central bank holds 'steady'",
    imageUrl: "https://news.test/img/lead.jpg",
    canonicalUrl: "https://news.test/markets/rates",
  });
});

test("falls back to <title> and returns only what exists", () => {
  assert.deepEqual(parsePageMetadata("<head><title> Hello </title></head>", "https://a.test"), { title: "Hello" });
});
