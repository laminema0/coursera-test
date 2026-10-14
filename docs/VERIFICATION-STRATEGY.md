# Verification Strategy (free-only, English first)

**Goal:** a trustworthy source for breaking ("zero-day") news. Every claim shows how many **independent** sources
confirm it, and conflicting numbers are shown as a range with the most-reported value.

**Constraints:** no budget, non-commercial. Free sources and free tools only.
Paid APIs (X, news APIs, AI APIs) are a **later milestone**, if subscriptions ever pay for them.

**Languages:** English (v1) → German → French, Spanish, Persian → more.

> **Competitors:** **Ground News** is the closest. It shows how many outlets cover a story and their political lean, but it doesn't check individual claims or conflicting numbers. **Dataminr** and **Factal** do real-time verified alerts, but only as paid enterprise products. No free consumer app checks claim-by-claim confirmation and conflicting numbers for breaking news. That's the gap.

---

## How it works

```
 55 free sources (sources/en.json)              later: GDELT, Bluesky, Telegram
 ├─ tier 1: public broadcasters, major papers
 ├─ tier 2: national/regional outlets
 ├─ primary: UN, WHO, USGS, GDACS, governments
 └─ signal: Reddit (early chatter only)
            │ RSS / Atom / GeoJSON, polled politely (ETag, ≥5 min, backoff)
            ▼
 ① Collect  → Article {headline, ≤300-char summary, link, source}         ✅ built
 ② Group    → Event   (articles about the same incident)                  ✅ built
 ③ Extract  → Claims  (numbers + who they come from, statements, denials) ✅ built (rules)
 ④ Score    → status per event, counting only INDEPENDENT sources         ✅ built
            ⚪ Unverified → 🟡 Reported → 🟢 Corroborated → ✅ Confirmed
                                    🔴 Disputed   ⚫ Retracted
 ⑤ Numbers  → range · most-reported · latest official · timeline          ✅ built
 +  Coverage → how many outlets/countries worldwide (GDELT, free)         ✅ built
 +  First report → who reported first, and when                          ✅ built
 +  Ranking  → importance + "breaking" flag (still developing)            ✅ built
 +  Chatter  → numbers social posts mention, shown apart from figures     ✅ built
 +  Track record → each source's early numbers vs final official figure   ✅ built (learning)
            ▼
 iOS app (no accounts, no tracking)
```

---

## Card chain

### 1. Paying for news data
🟥 **1. News APIs and X cost money** (X ≈ $0.005 per post; commercial news APIs start around hundreds of dollars a month).
🟩 Use **free publisher RSS feeds**. Almost every serious outlet publishes them for exactly this use.
**55 English sources** across 20+ countries are in `backend/sources/en.json`.

&nbsp;&nbsp;🟥 **1a. The biggest wire agencies (Reuters, AP, AFP) have no free feeds.**
&nbsp;&nbsp;🟩 Their reports still reach us through outlets that republish them with a credit ("— Reuters", "(AP)").
We detect the credit and count the story **once, as the wire**, not once per outlet. This is also the main defense against fake "confirmation" (Card 3).
Next step: GDELT (free, worldwide, updates every 15 minutes) shows how far an event has spread.

&nbsp;&nbsp;🟥 **1b. Feeds break and change URLs without notice.**
&nbsp;&nbsp;🟩 `npm run check-sources` tests every feed. Each source tracks its health, failures back off exponentially (capped at 6 hours), and `/v1/sources` shows which sources are down.

&nbsp;&nbsp;🟥 **1c. Polling too often could get us blocked.**
&nbsp;&nbsp;🟩 Conditional requests (ETag / Last-Modified) mean an unchanged feed costs almost nothing. Intervals are 5–60 minutes per source, and the User-Agent names the project honestly.

&nbsp;&nbsp;🟥 **1d. Feeds carry only a headline and a short summary.**
&nbsp;&nbsp;🟩 That's enough to group articles and spot most numbers ("at least 12 killed" is usually in the summary).
It also keeps us safe on copyright (Card 2). We fetch full articles only if later steps prove it's needed.

### 2. Copyright (including Germany's press publishers' right)
🟥 **2. We may not copy news articles.**
🟩 We store only the headline, a summary of at most 300 characters, and the link, and the app always sends readers to the publisher.
This is the long-accepted aggregator pattern. *Get a short legal check before a public launch.*

### 3. Confirmation that isn't really confirmation
🟥 **3. Thirty outlets repeating one wire story looks like thirty confirmations.**
🟩 Count **independent** sources only:
- the **owner** field groups related outlets (all BBC feeds count as one, and so do Euronews and Africanews);
- wire credits in the text (Card 1a);
- near-identical headlines and summaries are treated as copies (text similarity, free).

&nbsp;&nbsp;🟥 **3a. "X% of sources confirm" is misleading, because silence isn't denial.**
&nbsp;&nbsp;🟩 Show plain counts: **confirm / deny / not mentioned**, plus the **status levels** (⚪🟡🟢✅🔴⚫) instead of a single percentage.

&nbsp;&nbsp;🟥 **3b. State-funded media on stories about their own government.**
&nbsp;&nbsp;🟩 Sources are marked `stateFunded`. For claims about that government, they count as the **government's own voice** (like an official statement), not as independent confirmation.

&nbsp;&nbsp;🟥 **3c. Coordinated campaigns repeat one claim in many places.**
&nbsp;&nbsp;🟩 Only curated, known outlets can confirm a claim. Social sources are tier `signal` and **never** move a claim beyond ⚪.

### 4. AI for extracting claims costs money
🟥 **4. Paid AI APIs charge per request.**
🟩 Free options, in order:
1. **Rules** for the most important patterns: casualty and injury numbers ("at least N killed"), "X said / denied", locations from a free place-name list (GeoNames). Fast, free, and testable.
2. **Free open-source language-processing libraries** to find people, organizations and places.
3. **An open-weights AI model running on your own computer** (e.g. via Ollama) for harder sentences. Free, just slower.

A paid AI API is a later milestone.

### 5. Hosting with no budget
🟥 **5. A server that runs all the time usually costs money.**
🟩 Development: run it on your own computer. Public: **Oracle Cloud "Always Free"** VM (always on, enough for 55 feeds) or a Raspberry Pi at home. Step-by-step guide: [DEPLOY.md](DEPLOY.md).

&nbsp;&nbsp;🟥 **5a. Free cron services (e.g. GitHub Actions) can start 10–30+ minutes late.**
&nbsp;&nbsp;🟩 That's too slow for breaking news, so use an always-on process. Cron is only a backup.

&nbsp;&nbsp;🟥 **5b. A database server costs money.**
&nbsp;&nbsp;🟩 72 hours of articles from 55 feeds is only about 10–20k items. They fit in memory with JSON snapshots; switch to SQLite (a free single file) when needed.

### 6. Apple costs
🟥 **6. Publishing on the App Store needs the Apple Developer Program ($99/year).**
🟩 Until launch: install on your own iPhone with a **free Apple ID** from Xcode. The app expires after 7 days, so re-install from Xcode. Pay $99 only at the launch milestone.

&nbsp;&nbsp;🟥 **6a. Push notifications for breaking news need the paid program.**
&nbsp;&nbsp;🟩 Until then, the app refreshes when opened and with background refresh. Push comes at launch.

### 7. Speed vs. reliability
🟥 **7. In the first minutes, almost nothing is confirmed.**
🟩 That's correct, and the app says so: claims appear as ⚪ and the status visibly changes as independent sources arrive.
Primary sources (USGS, GDACS, government feeds) can move a claim to ✅ within minutes.

&nbsp;&nbsp;🟥 **7a. RSS feeds update minutes later than social media.**
&nbsp;&nbsp;🟩 Use **Reddit RSS** (free) now, and Bluesky (free public API) next, as **early signals** that start an event as ⚪.
They are never used as confirmation.

### 8. Privacy and law (project based in Germany)
🟥 **8. GDPR applies as soon as we process personal data.**
🟩 No accounts, no tracking, no analytics in v1. We collect no personal data. Add a simple privacy policy and Impressum before release.

### 9. Later languages
🟥 **9. Claims in different languages must still match each other.**
🟩 Every article has a `language` field, with one source list per language (`sources/de.json`, …).
Cross-language matching uses numbers, places and dates (language-independent) plus translation, which is a later milestone.

---

## How the status is decided (built)
| Status | Rule |
|---|---|
| ⚫ Retracted | a news or official source reports a correction or retraction |
| 🔴 Disputed | at least one independent source reports a denial, "false", "debunked"… |
| ✅ Confirmed | an official source (USGS, GDACS, UN, WHO, governments) reports it |
| 🟢 Corroborated | ≥ 3 independent sources, or ≥ 2 including one tier-1 source |
| 🟡 Reported | 1 independent source, or 2 tier-2 sources |
| ⚪ Unverified | only social posts, or only state media of the country involved |

"Independent" = different owner; wire copies ("— Reuters") count once as the wire; near-identical text counts once.

**"Which number is most spoken about":** two separate answers, never mixed:
- *Figures*: the value reported by the most independent news/official sources (verified side).
- *Chatter*: the values social posts mention most (unverified side), e.g. "on social media: 20 (2 posts), 50 (1 post)".

**Numbers:** each source's *latest* value counts (early counts get replaced as sources update). We show the range, the value reported by the most independent sources, and the latest value from officials (or attributed to them: "police said…").

## Status
| # | Card | Status |
|---|---|---|
| 1 | Free data (55 RSS + official feeds) | 🟩 built |
| 1a–d | Wires, broken feeds, politeness, short summaries | 🟩 built (wire-credit detection in step ③) |
| 2 | Copyright | 🟩 built |
| 3 | Independence, honest counts, state media, campaigns | 🟩 built |
| 4 | Free claim extraction | 🟩 built (rules); local AI model later for harder sentences |
| 5 | Free hosting | 🟩 decided |
| 6 | Apple costs | 🟩 decided |
| 7 | Speed vs. reliability | 🟩 designed |
| 8 | Privacy | 🟩 decided |
| 9 | Languages | 🟩 prepared |

## Quality checks
- Backend: 61 tests (`npm test`), including realistic breaking-news fixtures and hard negatives (same place, different story).
- Swift: `scripts/swift-linux-check.sh` compiles and tests all non-UI Swift code with the official Swift 6.1 image. It caught a real compile error.
- End-to-end: local RSS feeds → collector → analysis → `/v1/events` verified (statuses, numbers, filters, saved state).
- Not yet checked against live feeds: this environment blocks news sites. Run `npm run check-sources` and `npm run analyze` on your machine.

## Milestones that need money (not now)
- X API (`docs/X-INTEGRATION.md`; code is ready and switches on with `X_BEARER_TOKEN`)
- Paid news or AI APIs
- Apple Developer Program ($99/year) at launch
