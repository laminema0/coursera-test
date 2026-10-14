import type { Config } from "../src/config.ts";
import type { XPost, XUser } from "../src/x/types.ts";

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    xBearerToken: "test-token",
    xApiBaseUrl: "https://api.x.test/2",
    groups: [{ id: "news", label: "News", accounts: ["Reuters", "AP"], pollMinutes: 5, maxResultsPerPoll: 20 }],
    dailyBudgetUsd: 1,
    prices: { postRead: 0.005, userRead: 0.01 },
    retentionHours: 24,
    complianceCheckMinutes: 60,
    profileRefreshHours: 72,
    firstRunLookbackMinutes: 120,
    maxQueryLength: 512,
    maxPagesPerPoll: 3,
    port: 0,
    ...overrides,
  };
}

export function post(id: string, authorId: string, articleUrl: string, extra: Partial<XPost> = {}): XPost {
  return {
    id,
    text: `Story ${id} https://t.co/${id}`,
    author_id: authorId,
    created_at: "2026-10-14T10:00:00.000Z",
    entities: { urls: [{ start: 9, end: 30, url: `https://t.co/${id}`, expanded_url: articleUrl }] },
    public_metrics: { like_count: 1, retweet_count: 2, reply_count: 3, quote_count: 4 },
    ...extra,
  };
}

export function user(id: string, username: string): XUser {
  return { id, username, name: username.toUpperCase(), profile_image_url: `https://img.test/${id}.jpg`, verified: true };
}

export interface FakeX {
  fetch: typeof fetch;
  requests: URL[];
  /** Posts returned by search, newest first. */
  searchResults: XPost[];
  /** Posts that still exist on X (for lookups). Defaults to everything ever returned by search. */
  alive: Map<string, XPost>;
  users: Map<string, XUser>;
  rateLimitNext: boolean;
  rateLimitResetAt: Date;
}

/** In-process fake of the X API v2 endpoints this service uses. */
export function fakeX(): FakeX {
  const state: FakeX = {
    requests: [],
    searchResults: [],
    alive: new Map(),
    users: new Map(),
    rateLimitNext: false,
    rateLimitResetAt: new Date("2026-10-14T10:15:00Z"),
    fetch: async (input) => {
      const url = new URL(String(input));
      state.requests.push(url);
      if (state.rateLimitNext) {
        state.rateLimitNext = false;
        return new Response("{}", { status: 429, headers: { "x-rate-limit-reset": String(state.rateLimitResetAt.getTime() / 1000) } });
      }
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

      if (url.pathname.endsWith("/tweets/search/recent")) {
        const sinceId = url.searchParams.get("since_id");
        const max = Number(url.searchParams.get("max_results"));
        const matching = state.searchResults.filter((p) => !sinceId || BigInt(p.id) > BigInt(sinceId)).slice(0, max);
        for (const p of matching) state.alive.set(p.id, p);
        return json({
          data: matching.length ? matching : undefined,
          meta: { result_count: matching.length, newest_id: matching[0]?.id, oldest_id: matching.at(-1)?.id },
        });
      }
      if (url.pathname.endsWith("/tweets")) {
        const ids = (url.searchParams.get("ids") ?? "").split(",");
        return json({
          data: ids.filter((id) => state.alive.has(id)).map((id) => state.alive.get(id)),
          errors: ids.filter((id) => !state.alive.has(id)).map((id) => ({ resource_id: id, title: "Not Found Error" })),
        });
      }
      if (url.pathname.endsWith("/users")) {
        const ids = (url.searchParams.get("ids") ?? "").split(",");
        return json({ data: ids.filter((id) => state.users.has(id)).map((id) => state.users.get(id)) });
      }
      return new Response("not found", { status: 404 });
    },
  };
  return state;
}

export class Clock {
  current: Date;
  constructor(iso: string) {
    this.current = new Date(iso);
  }
  now = (): Date => this.current;
  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}
