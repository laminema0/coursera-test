import type { XLookupResponse, XPost, XSearchResponse, XUser } from "./types.ts";

export class XApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`X API responded ${status}: ${body.slice(0, 300)}`);
    this.status = status;
    this.body = body;
  }
}

export class XRateLimitError extends XApiError {
  readonly resetAt: Date;

  constructor(body: string, resetAt: Date) {
    super(429, body);
    this.resetAt = resetAt;
  }
}

export const POST_FIELDS = "id,text,author_id,created_at,lang,possibly_sensitive,entities,public_metrics,edit_history_tweet_ids";
export const USER_FIELDS = "id,name,username,profile_image_url,verified,verified_type";

export interface SearchParams {
  query: string;
  maxResults: number;
  sinceId?: string;
  startTime?: Date;
  nextToken?: string;
}

/**
 * Minimal X API v2 client using an app-only Bearer token.
 * The token lives only on this server. It must never ship inside the iOS app.
 */
export class XClient {
  readonly #token: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: { bearerToken: string; baseUrl?: string; fetch?: typeof fetch }) {
    this.#token = options.bearerToken;
    this.#baseUrl = (options.baseUrl ?? "https://api.x.com/2").replace(/\/$/, "");
    this.#fetch = options.fetch ?? fetch;
  }

  /** GET /2/tweets/search/recent (last 7 days). Billed per post returned. */
  searchRecent(params: SearchParams): Promise<XSearchResponse> {
    const query: Record<string, string> = {
      query: params.query,
      max_results: String(Math.min(100, Math.max(10, params.maxResults))),
      "tweet.fields": POST_FIELDS,
    };
    if (params.sinceId) query.since_id = params.sinceId;
    else if (params.startTime) query.start_time = params.startTime.toISOString();
    if (params.nextToken) query.next_token = params.nextToken;
    return this.#get("/tweets/search/recent", query);
  }

  /** GET /2/tweets?ids= (max 100). Missing posts come back in `errors`. */
  lookupPosts(ids: string[]): Promise<XLookupResponse<XPost>> {
    return this.#get("/tweets", { ids: limit100(ids).join(","), "tweet.fields": POST_FIELDS });
  }

  /** GET /2/users?ids= (max 100). Billed per user returned. */
  lookupUsers(ids: string[]): Promise<XLookupResponse<XUser>> {
    return this.#get("/users", { ids: limit100(ids).join(","), "user.fields": USER_FIELDS });
  }

  async #get<T>(path: string, query: Record<string, string>): Promise<T> {
    const url = `${this.#baseUrl}${path}?${new URLSearchParams(query)}`;
    const response = await this.#fetch(url, {
      headers: { Authorization: `Bearer ${this.#token}`, "User-Agent": "news-ingestion/0.1" },
    });
    const body = await response.text();

    if (response.status === 429) {
      const reset = Number(response.headers.get("x-rate-limit-reset"));
      const resetAt = Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000) : new Date(Date.now() + 15 * 60_000);
      throw new XRateLimitError(body, resetAt);
    }
    if (!response.ok) {
      throw new XApiError(response.status, body);
    }
    return JSON.parse(body) as T;
  }
}

function limit100(ids: string[]): string[] {
  if (ids.length === 0 || ids.length > 100) {
    throw new RangeError(`X lookups take 1–100 ids, got ${ids.length}`);
  }
  return ids;
}
