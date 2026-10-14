# News from X: Getting Posts from the X API into the App

How the app gets news and posts from X (Twitter).
The design is worked out as **limitation cards**: every 🟥 red card is a limitation. Each solution can raise new 🟥 cards,
and we keep solving until every card is 🟩 green.

> Scope: data extraction and integration only. No UI and no product features yet.
> X prices and rules change often (last checked Oct 2026). Re-check the X Developer Console before launch.

---

## Final architecture (all cards green)

```
 ┌──────────── X API v2 ────────────┐            ┌──── Publisher websites ────┐
 │ GET /2/tweets/search/recent      │            │ <meta og:title/og:image…>  │
 │ GET /2/tweets?ids=   (compliance)│            └─────────────┬──────────────┘
 │ GET /2/users?ids=    (profiles)  │                          │ headline, summary, image
 └───────────────┬──────────────────┘                          │ (free, no X cost)
                 │ Bearer token (server only)                  │
        ┌────────▼───────────────────────────────────────────▼────────┐
        │  backend/  Ingestion service (Node + TypeScript)            │
        │  every minute:                                              │
        │   1. expire posts older than 24h                            │
        │   2. compliance: re-check posts, remove deleted ones        │
        │   3. poll due source groups (since_id, daily USD budget)    │
        │   4. refresh author profiles                                │
        │   5. post → article URL → canonical URL → Story             │
        │   6. enrich stories from the publisher page                 │
        │  GET /v1/feed?since=  →  stories + posts + removed_post_ids │
        └────────────────────────────┬────────────────────────────────┘
                                     │ HTTPS, our own API
        ┌────────────────────────────▼────────────────────────────────┐
        │  iOS app  LiveFeedRepository → FeedStore                    │
        │  never holds an X key, deletes removed posts on the device  │
        └─────────────────────────────────────────────────────────────┘
```

---

## Card chain

### Card 1: Where do we call the X API from?
🟥 **1. Calling X from the iOS app** means shipping the API key inside the app. Anyone can extract it from the binary
and spend our credits, or get our developer account suspended.
🟩 **Solution:** a small **backend service** holds the key. The app talks only to our own API (`/v1/feed`).

&nbsp;&nbsp;🟥 **1a. A backend costs money and needs maintenance.**
&nbsp;&nbsp;🟩 One small Node process with no runtime dependencies. It runs on any $0–5/month host (Fly.io, Render, a small VPS).
The key is stored as an environment secret and never in git (`backend/.env.example`).

### Card 2: Cost
🟥 **2. X API is pay-per-use:** about **$0.005 per post read** and **$0.010 per user read**, from prepaid credits.
The old fixed Basic/Pro plans are closed to new sign-ups. If every app user fetched posts,
cost would grow with users: 10,000 users × 100 posts/day ≈ **$5,000/day**.
🟩 **Solution:** fetch **once on the server** and serve every user from that copy.
Cost now depends only on how many *new posts* our sources publish, not on the number of users.

&nbsp;&nbsp;🟥 **2a. Even server-side, many sources can still cost a lot.**
&nbsp;&nbsp;🟩 Four controls:
- **Curated source groups** (`backend/sources.json`) instead of open keyword search.
- **`since_id`**: each poll returns only posts we haven't seen yet. Polls with no new posts return nothing and cost nothing, so polling more often improves freshness without raising cost.
- **Search filter** `has:links -is:retweet -is:reply`: we never pay for replies, reposts or posts without an article link.
- **Hard daily budget in USD** (`DAILY_BUDGET_USD`). When it runs out, polling stops until 00:00 UTC.

&nbsp;&nbsp;🟥 **2b. Polling each account separately wastes requests and rate limit.**
&nbsp;&nbsp;🟩 Accounts are packed into a few queries: `(from:Reuters OR from:AP …) has:links -is:retweet -is:reply`, split to stay under the 512-character query limit (`src/x/query.ts`).

&nbsp;&nbsp;🟥 **2c. A search request must ask for at least 10 results** (`max_results` ≥ 10), so one poll can cost up to $0.05.
A budget with only a few cents left could be overspent.
&nbsp;&nbsp;🟩 The ingester polls only while the budget can cover 10 results. Otherwise it skips and reports `skippedForBudget`.

&nbsp;&nbsp;🟥 **2d. Showing a post also needs its author (name, @handle, avatar).** User reads cost $0.010 each.
&nbsp;&nbsp;🟩 Profiles are cached and refreshed every 72 hours (`PROFILE_REFRESH_HOURS`), in batches of 100.
A small, fixed set of news accounts means only a few cents per refresh.

&nbsp;&nbsp;🟥 **2e. Prices have changed several times since 2023.**
&nbsp;&nbsp;🟩 Prices are configuration (`PRICE_POST_READ`, `PRICE_USER_READ`), not code. See also Card 6.

**Example estimate** (sources in `sources.json`, 11 accounts): about 400–600 new linked posts per day ≈ **$2–3/day** with no limit.
A $1 daily budget caps spend at **~$30/month**. When it runs out, the feed simply updates less until 00:00 UTC.

### Card 3: Rate limits and outages
🟥 **3. X returns `429 Too Many Requests`** when limits are hit.
🟩 The client reads `x-rate-limit-reset` and pauses **all** X calls until that time. The pause survives restarts (it's in the snapshot). The feed keeps serving cached content.

&nbsp;&nbsp;🟥 **3a. X down, or the account suspended.**
&nbsp;&nbsp;🟩 The app depends only on our API. The backend keeps serving what it has, and stories still get headlines from publisher pages.
Adding a second source type (publisher RSS feeds, free) behind the same Story model is the next step (Card 6).

### Card 4: A post is not a news article
🟥 **4. Posts are short text plus a `t.co` link.** That isn't a news item by itself.
🟩 **Solution:** take the **article link** from the post: `entities.urls[].unwound_url` / `expanded_url`, skipping links that point back to X.
Each article becomes a **Story**, and the posts that shared it are attached to it (`src/news/url.ts`).

&nbsp;&nbsp;🟥 **4a. The same article appears with different tracking links** (`?utm_source=…`, `www.`, `/amp`).
&nbsp;&nbsp;🟩 URL canonicalization: strip tracking parameters, fragment, `www/m/amp` prefixes and trailing slashes,
sort the query, and prefer the publisher's own `<link rel="canonical">`. Story ID = hash of the canonical URL.

&nbsp;&nbsp;🟥 **4b. A post has no headline or image.**
&nbsp;&nbsp;🟩 Fetch the publisher page once and read the **Open Graph tags** (`og:title`, `og:description`, `og:image`).
This costs nothing on X. Limits: 5-second timeout, 512 KB maximum, 10 pages per cycle (`src/news/opengraph.ts`).

&nbsp;&nbsp;🟥 **4c. Copyright: we may not copy articles.** This includes the EU/German press publishers' right (Leistungsschutzrecht).
&nbsp;&nbsp;🟩 We store only the headline, the publisher's own short summary, and the image URL, and always link to the original.
We never copy body text. *Get a legal review before launch.*

&nbsp;&nbsp;🟥 **4d. Spam, fake news and random accounts.**
&nbsp;&nbsp;🟩 Only curated accounts (agencies, publishers, journalists) are queried. There is no open keyword search in the MVP.
`possibly_sensitive` is passed to the app so it can hide or blur those posts.

&nbsp;&nbsp;🟥 **4e. The same story from *different* publishers stays as separate stories.**
&nbsp;&nbsp;🟩 Accepted for the MVP: one story per article. Grouping by topic (title similarity or embeddings) comes later.
It doesn't affect the X integration.

### Card 5: X Developer Policy
🟥 **5. Deleted posts must disappear** from our service quickly (within ~24h of a removal request).
🟩 The **compliance job** re-checks every stored post at least every 60 minutes, using `GET /2/tweets?ids=` with 100 per request.
Posts that are missing are removed and recorded as a tombstone.

&nbsp;&nbsp;🟥 **5a. Re-checking costs money: every re-check is a post read.**
&nbsp;&nbsp;🟩 X **doesn't charge again for the same post within one UTC day**. Our budget tracks this the same way (`src/budget.ts`),
so hourly re-checks of posts we already read today cost **$0**. Posts are also kept for only **24 hours** (news goes stale fast),
so a post is paid for again at most once, when it crosses midnight UTC.

&nbsp;&nbsp;🟥 **5b. If the budget is used up, we can't re-check, and we must not show posts we can't verify.**
&nbsp;&nbsp;🟩 Compliance runs **before** polling and has priority. If even that can't be paid for, those posts are **removed**.
Removing content is always compliant.

&nbsp;&nbsp;🟥 **5c. Copies already on users' phones.**
&nbsp;&nbsp;🟩 The app sends `since=<last sync>`. The response includes `removed_post_ids`, and `FeedStore` deletes them on the device too.

&nbsp;&nbsp;🟥 **5d. Display rules:** show posts unmodified, with author name, @handle, avatar and a link back to X.
&nbsp;&nbsp;🟩 The API sends `text` unchanged, plus `author` and `permalink`. A post without a known author profile isn't served at all.
*(The visual design comes in the UI phase and must follow X's display requirements.)*

&nbsp;&nbsp;🟥 **5e. Redistribution limits** (third parties may receive only post IDs, up to 1.5M per 30 days).
&nbsp;&nbsp;🟩 Only our own app's users see full posts. That is display, not redistribution. The feed API isn't offered as a public or partner API.

&nbsp;&nbsp;🟥 **5f. Using X content for AI:** training models on it is forbidden.
&nbsp;&nbsp;🟩 No AI use in this phase. Any later AI summaries must be checked against the Developer Agreement first.

&nbsp;&nbsp;🟥 **5g. Use-case declaration:** X requires an accurate description of the use case, and approval for changes.
&nbsp;&nbsp;🟩 Action item: describe the app in the Developer Console as a *"news aggregator displaying public posts from curated news accounts, with links to the original posts and articles"*.

### Card 6: Depending on one platform
🟥 **6. X has changed prices and access suddenly** (2023, 2024, 2026).
🟩 The app depends on our **Story** model, not on X. X is one source adapter. Publisher **RSS** feeds (free) can plug into the same Story pipeline,
so the app keeps working if X becomes too expensive. *(RSS adapter: next step, outside this phase.)*

### Card 7: Personalization ("my own X timeline")
🟥 **7. Per-user X data** needs each user to sign in with X (OAuth 2.0 PKCE), and costs per user again.
🟩 Out of scope for the MVP. Personalization is done by filtering **our** shared pool (topics and sources the user picks), so cost stays the same.

### Card 8: Freshness for breaking news
🟥 **8. Polling isn't real-time.**
🟩 Breaking sources are polled every **5 minutes**, which is fine for a news app. Polling doesn't add cost (Card 2a).
A *filtered stream* (one always-on connection) is a later upgrade if seconds matter.

---

## Status: all cards 🟩

| Card | Topic | Solved by |
|---|---|---|
| 1 | API key security | `backend/` holds the token; app uses `/v1/feed` |
| 2 | Cost | server-side fetch, combined queries, `since_id`, filter, daily USD budget, cached profiles |
| 3 | Rate limits / outages | 429 pause until reset; cached feed keeps serving |
| 4 | Post → news | article URL extraction, canonical URLs, Stories, Open Graph enrichment |
| 5 | X policy | hourly compliance check (free within a UTC day), 24h retention, tombstones synced to the device |
| 6 | Platform risk | Story model independent of X; RSS adapter next |
| 7 | Personalization | shared pool, filtered per user |
| 8 | Freshness | 5-minute polling for breaking news |

## Code map
| Part | File |
|---|---|
| X API client (search, lookups, 429 handling) | `backend/src/x/client.ts` |
| Combined search queries | `backend/src/x/query.ts` |
| Daily budget with UTC-day dedup | `backend/src/budget.ts` |
| Article URL extraction and canonicalization | `backend/src/news/url.ts` |
| Publisher page metadata | `backend/src/news/opengraph.ts` |
| Ingestion cycle (compliance → poll → profiles → enrich) | `backend/src/ingest.ts` |
| Feed API | `backend/src/feed.ts`, `backend/src/server.ts` |
| iOS models / repository / store | `MyApp/Features/Feed/` |
| Tests | `backend/test/`, `MyAppTests/FeedTests.swift` |

## Running it
```bash
cd backend
npm install
cp .env.example .env        # add X_BEARER_TOKEN from the X Developer Console
npm test                    # 20 tests, fake X API, no credits used
npm start                   # feed at http://localhost:8787/v1/feed
```
In the app, set `USE_MOCK_DATA = NO` in `Configs/Debug.xcconfig` to use the local backend.

## Open questions
1. Final list of news accounts and topics (`backend/sources.json`).
2. Daily budget you're comfortable with (default $1/day).
3. Hosting choice for the backend.
