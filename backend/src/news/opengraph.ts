export interface PageMetadata {
  title?: string;
  description?: string;
  imageUrl?: string;
  canonicalUrl?: string;
}

const MAX_BYTES = 512 * 1024;

/**
 * Reads headline, summary and image from a page's Open Graph / Twitter Card tags.
 * We store only these short fields and link to the publisher. We never copy article text.
 */
export function parsePageMetadata(html: string, pageUrl: string): PageMetadata {
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd >= 0 ? html.slice(0, headEnd) : html;
  const meta = new Map<string, string>();

  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = attribute(tag, "property") ?? attribute(tag, "name");
    const content = attribute(tag, "content");
    if (key && content !== undefined && !meta.has(key.toLowerCase())) {
      meta.set(key.toLowerCase(), decodeEntities(content).trim());
    }
  }
  const canonicalTag = head.match(/<link\b[^>]*rel=["']?canonical["']?[^>]*>/i)?.[0];
  const titleTag = head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];

  return clean({
    title: meta.get("og:title") ?? meta.get("twitter:title") ?? (titleTag ? decodeEntities(titleTag).trim() : undefined),
    description: meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description"),
    imageUrl: absolute(meta.get("og:image") ?? meta.get("twitter:image"), pageUrl),
    canonicalUrl: absolute(meta.get("og:url") ?? (canonicalTag ? attribute(canonicalTag, "href") : undefined), pageUrl),
  });
}

export async function fetchPageMetadata(url: string, fetchImpl: typeof fetch = fetch, timeoutMs = 5000): Promise<PageMetadata> {
  const response = await fetchImpl(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": "news-ingestion/0.1 (link preview)", Accept: "text/html" },
  });
  if (!response.ok || !(response.headers.get("content-type") ?? "").includes("html")) return {};
  const html = await readLimited(response, MAX_BYTES);
  return parsePageMetadata(html, response.url || url);
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes));
}

function attribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}

function absolute(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const point = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : whole;
    }
    return named[code.toLowerCase()] ?? whole;
  });
}

function clean(metadata: PageMetadata): PageMetadata {
  return Object.fromEntries(Object.entries(metadata).filter(([, v]) => v !== undefined && v !== "")) as PageMetadata;
}
