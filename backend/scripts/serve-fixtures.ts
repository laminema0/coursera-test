// Serves the test fixture feeds over HTTP and writes a matching sources file, for running the whole
// service locally without internet access:
//   node scripts/serve-fixtures.ts 9900 /tmp/fixture-sources.json
//   SOURCES_FILE=/tmp/fixture-sources.json GDELT=off DATA_DIR=/tmp/nv node src/main.ts
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { fixtureSourceList, rssFor } from "../test/fixtures/feeds.ts";

const port = Number(process.argv[2] ?? 9900);
const out = process.argv[3] ?? "data/fixture-sources.json";
const base = `http://127.0.0.1:${port}`;

writeFileSync(out, JSON.stringify(fixtureSourceList(base), null, 2));
createServer((request, response) => {
  const m = request.url?.match(/^\/feeds\/(.+)\.xml$/);
  if (m?.[1] === "broken") {
    response.writeHead(200, { "Content-Type": "application/rss+xml" }).end("<rss><channel><item><title>oops");
    return;
  }
  const body = m ? rssFor(m[1]!) : undefined;
  if (!body || !body.includes("<item>")) {
    response.writeHead(404).end("not found");
    return;
  }
  response.writeHead(200, { "Content-Type": "application/rss+xml" }).end(body);
}).listen(port, "127.0.0.1", () => console.log(`fixture feeds on ${base}/feeds/<id>.xml; sources written to ${out}`));
