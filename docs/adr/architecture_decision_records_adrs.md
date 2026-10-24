# Architecture Decision Records (ADRs) — News Timeline

This document contains the complete suite of Architecture Decision Records (ADRs) for the **News Timeline** platform, documenting the architectural shift from a desktop-first web prototype to a mobile-first web and native mobile application backed by NestJS, PostgreSQL, GDELT global news ingestion, and cached LLM intelligence.

---

## ADR Index

| ADR ID | Title | Status | Date |
| :--- | :--- | :--- | :--- |
| **ADR-001** | Pivot from Desktop 3-Column UI to Mobile-First Web & Native Mobile Architecture | Accepted | Oct 2026 |
| **ADR-002** | Backend Framework Selection: NestJS, Prisma ORM & PostgreSQL | Accepted | Oct 2026 |
| **ADR-003** | Global News Ingestion & Sentiment Engine via The GDELT Project & Custom RSS | Accepted | Oct 2026 |
| **ADR-004** | Cost-Controlled AI Topic Summarization & Source Comparison Pipeline | Accepted | Oct 2026 |
| **ADR-005** | Real-Time Live Event Streaming with WebSockets & Exponential Backoff | Accepted | Oct 2026 |
| **ADR-006** | Offline-First Reading & Background Bookmark Sync Architecture | Accepted | Oct 2026 |
| **ADR-007** | Tiered Freemium & B2B Team Subscription Monetization Architecture | Proposed | Oct 2026 |
| **ADR-008** | Multi-Source News Ingestion: Search API + RSS Archive + GDELT History (amends ADR-003) | Proposed | Oct 2026 |
| **ADR-009** | Region-Aware Feed Selection (extends ADR-008) | Proposed | Oct 2026 |

---

## ADR-001: Pivot from Desktop 3-Column UI to Mobile-First Web & Native Mobile Architecture

* **Status:** Accepted
* **Context:** The original specification defined a desktop-first (`> 1280px`) 3-column layout featuring a `68px` fixed left sidebar, central timeline feed, and inline right-hand article detail pane. However, product direction shifted to eliminate the desktop application layout and focus exclusively on a mobile-first web application (`< 640px` single-column paradigm) that compiles directly into native iOS (`.ipa`) and Android (`.aab`/`.apk`) apps for App Store and Google Play distribution.
* **Decision:**
  1. Standardize the frontend (`apps/web`) built on **React 19.1.0**, **Next.js 15.4.4**, and **Tailwind CSS 4** around the single-column mobile layout.
  2. Replace the `68px` left navigation sidebar with a thumb-friendly 6-item **Mobile Bottom Tab Bar** and render the **Article Detail** view as a full-screen slide-in overlay (`200ms` fade-in from right) with a scroll-tracked reading progress bar.
  3. Preserve the newspaper print editorial aesthetic (`Playfair Display`, `IBM Plex Sans`, `IBM Plex Mono`, `#0a0a0b` dark background, `#e83a2e` red breaking accents, and `#c9a84c` gold date labels) across mobile viewports.
  4. Provide two packaging paths for native mobile distribution: **Path A (Ionic Capacitor)** wrapping the Next.js static export (`output: 'export'`) for immediate 98% code reuse, and **Path B (React Native + Expo + NativeWind)** for 120Hz native OS views (`SectionList`) while sharing 100% of TypeScript interfaces, Axios services, and WebSocket hooks.
* **Consequences:**
  * **Positive:** Eliminates multi-column responsive layout overhead; ensures consistent UX across mobile web, PWA home-screen installs, and native iOS/Android binaries.
  * **Negative:** Requires replacing desktop keyboard-first patterns (e.g., `⌘K` search modal and hover tooltips) with touch-first interactions (swipeable filter chips and long-press bookmark actions).

---

## ADR-002: Backend Framework Selection: NestJS, Prisma ORM & PostgreSQL

* **Status:** Accepted
* **Context:** Phases 1–4 of the frontend were completed using client-side mock generators (`generateMockSummary()`, mock RSS feeds, and mock live events). A production backend is required to serve core REST endpoints (`/api/feed`, `/api/articles/:id`, `/api/search`, `/api/trending`, `/api/topics`, `/api/breaking`) alongside Phase 4 controllers (`/api/events`, `/api/summaries`, `/api/rss`, `/api/bookmarks`).
* **Decision:**
  1. Adopt **NestJS** (TypeScript) as the unified backend framework (`apps/api`) to share strict TypeScript interfaces (`LiveEvent`, `ComparisonArticle`, `TopicSummary`, `RSSFeed`) with the React 19 frontend.
  2. Use **PostgreSQL** managed via **Prisma ORM** as the primary relational datastore for `Article`, `Bookmark`, `LiveEvent`, `EventUpdate`, `TopicSummary`, and `RssFeed` models.
  3. Index `Article` on `(category, publishedAt DESC)` for fast chronological timeline queries and on `storyClusterId` to group multi-source coverage for the `SourceComparison` module.
* **Consequences:**
  * **Positive:** End-to-end TypeScript type safety across monorepo workspaces; modular dependency injection for cron workers, REST controllers, and WebSocket gateways.
  * **Negative:** Requires database migrations and connection pooling management in production.
* **Implementation notes (24 Oct 2026):**
  * Local Postgres: Homebrew `postgresql@16` or `docker compose up -d` (same `timeline/timeline` credentials). Migrations live in `apps/api/prisma/migrations/` and are applied with `pnpm db:deploy` (`pnpm db:migrate` in dev).
  * Pooling: Prisma's pool is sized via `connection_limit` / `pool_timeout` on `DATABASE_URL`. In production, put PgBouncer (or a Neon/Supabase pooled URL with `pgbouncer=true`) in front and add a `directUrl` for migrations.
  * Postgres is the read path: `NewsStore` queries articles and bookmarks on demand (feed pagination uses the `(category, publishedAt DESC)` / `(inFeed, publishedAt DESC)` indexes). Only the small tables (summaries, feeds, live events) are cached in memory. Without `DATABASE_URL`, or with an unmigrated DB, the API falls back to the in-memory store; `/api/health` reports `database` and `migrations`.
  * `Article.inFeed = false` marks story-only articles (resolvable by id and bookmarkable, but kept out of the feed and trending). `Story` / `StoryArticle` persist `/api/timeline` results (ADR-008 step 1).

---

## ADR-003: Global News Ingestion & Sentiment Engine via The GDELT Project & Custom RSS

* **Status:** Accepted
* **Context:** As a news aggregator covering 10 core categories (Technology, World News, Finance, Science, Politics, Climate, Health, Culture, Sports, Opinion), the platform needs continuous, multi-source global news data with sentiment (`positive`/`neutral`/`negative`), editorial bias (`left`/`center`/`right`), event importance (`critical`/`high`/`normal`/`low`), and topic volume trends (`rising`/`stable`/`declining`) without incurring prohibitive commercial News API licensing costs.
* **Decision:**
  1. Integrate **The GDELT Project (Global Database of Events, Language, and Tone)** as the primary automated news and event ingestion source via two pipelines:
     * **Pipeline A (GDELT DOC 2.0 REST API):** Poll every 15 minutes via Axios (`GdeltDocService`) to ingest categorized global articles, publisher domains, social thumbnails, and 7-day `TimelineTone`/`TimelineVol` curves.
     * **Pipeline B (Google Cloud BigQuery `gdelt-bq.gdeltv2`):** Query partitioned tables (`events_partitioned` and `gkg_partitioned`) using `_PARTITIONTIME` filters (`GdeltBigQueryService`) to extract high-velocity global events, mapping `GoldsteinScale` and `NumMentions` to `critical`, `high`, `normal`, and `low` importance levels.
  2. Pair GDELT with the **Custom RSS Feed Ingestion** controller (`/api/rss`), allowing users to add, validate (XML/Atom check + URL sanitization), and toggle custom RSS feeds (such as Hacker News, BBC News, TechCrunch).
* **Consequences:**
  * **Positive:** Delivers real-time, worldwide coverage across 100+ languages updated every 15 minutes with pre-computed tone/sentiment scores for **$0** (staying within GCP BigQuery's 1 TB/month free tier via partition pruning).
  * **Negative:** GDELT DOC 2.0 enforces a 1-request-per-5-seconds rate limit, requiring staggered ingestion queues (`5500ms` delay between category fetches) in the background worker.
* **Amended by ADR-008 (24 Oct 2026):** GDELT DOC is no longer the primary source. It runs behind the `NewsProvider` interface as an hourly category sweep plus a ≤ 1-week story search, with a 429 cooldown breaker (2 → 15 min). Curated publisher RSS now carries the home feed.

---

## ADR-004: Cost-Controlled AI Topic Summarization & Source Comparison Pipeline

* **Status:** Accepted
* **Context:** Phase 4 requires AI-generated topic summaries (`TopicSummaryCard.tsx`) with extracted key points, confidence scores (`0–1`), sentiment classification, and related topics, as well as multi-source story comparisons (`SourceComparison.tsx`) highlighting common themes and key differences. Invoking an LLM on every user page load would create high latency and unsustainable token bills.
* **Decision:**
  1. Decouple LLM execution from user read requests (`GET /api/summaries/:topicName`): generate summaries asynchronously on a scheduled background cron job (every 3–6 hours) via `POST /api/summaries/generate` and persist the structured JSON output in PostgreSQL (`TopicSummary` table) and client `localStorage`.
  2. Standardize on **Ultra-Light / Flash tier LLMs** (e.g., Gemini 2.5 Flash-Lite, GPT-4o-mini, or Claude Haiku) for structured JSON summarization and theme extraction.
  3. Pass only article `headline`, `source`, and `excerpt` (excluding full HTML bodies) into prompts, and deduplicate user-submitted RSS feed URLs globally.
* **Consequences:**
  * **Positive:** Keeps baseline infrastructure LLM costs between **$1.00 and $6.00/month** (~10.5M total tokens/month) and sub-50ms response times for end users reading cached summaries.
  * **Negative:** Summaries reflect a 3–6 hour periodic snapshot rather than instantaneous per-second synthesis unless triggered by a `critical` breaking event.
* **Implementation notes (24 Oct 2026):**
  * **Provider:** the LLM sits behind `LlmProvider` (`apps/api/src/llm/`), selected by `LLM_PROVIDER`. **Ollama with `llama3.2` (3B, local) is the interim provider**; Gemini / Claude / OpenAI are added later as one class each. Output is constrained by a JSON schema (Ollama `format`) and validated server-side.
  * **Story briefs (extension of the cron-only rule):** story searches are open-ended, so their briefs can't be pre-computed. A brief is generated **in the background the first time a story is viewed** (never on the request path), stored in `TopicSummary` (`kind='story'`), and reused while its input hash (the set of report ids) is unchanged or it is under 30 min old. Topic summaries stay on the cron.
  * **Inputs:** headline, source, date and an excerpt of at most 300 chars, up to 20 reports per story and 12 per topic, round-robin across sources. Report text is treated as untrusted and delimited.
  * **Fallbacks:** if the LLM is down or disabled, topic summaries use the headline heuristic and story briefs are omitted (the UI hides the panel).
  * **Cost when moving to a cloud model:** about 20 reports × ~100 tokens ≈ 2–3k input tokens + ~300 output tokens per brief. Briefs are cached and regenerated only when coverage changes.
* **Cloud provider (25 Oct 2026):** `LLM_PROVIDER=anthropic` uses Claude Haiku 5.5 through the Anthropic SDK with structured outputs (`output_config.format`), effort `low`. A global `LLM_DAILY_TOKEN_LIMIT` (default 2M tokens/day) caps spend until per-user quotas exist (ADR-007). At ~2.5k input + ~0.3k output tokens per brief, that is roughly 700 briefs a day; at Haiku 5.5's $0.10 / $0.50 per MTok it is about $0.35/day at the cap.
* **Source comparison (25 Oct 2026):** for stories with ≥ 3 sources the brief call also returns shared themes and per-source differences (validated against the real source names), stored with the brief and shown under it on `/story`. Remaining for ADR-004: per-user quotas (needs ADR-007).

---

## ADR-005: Real-Time Live Event Streaming with WebSockets & Exponential Backoff

* **Status:** Accepted
* **Context:** Users following breaking events (e.g., elections, sporting finals, diplomatic summits) require moment-by-moment updates pushed directly to their timeline without manual page refreshes. Mobile networks frequently drop connections when switching between Wi-Fi and cellular data.
* **Decision:**
  1. Implement a NestJS WebSocket Gateway (`EventsGateway` on namespace `/ws/events`) paired with `POST /api/events` to broadcast `EventUpdate` payloads (`ongoing`, `completed`, `scheduled`) in real time.
  2. Manage client connections via `useWebSocket.ts` and `LiveEventsContext.tsx`, enforcing automatic reconnection with **exponential backoff up to a maximum of 5 retries**.
  3. Automatically fall back to cached or pre-loaded event timelines when the WebSocket server is unreachable.
* **Consequences:**
  * **Positive:** Prevents thundering-herd server overload during network blips while delivering sub-second breaking news dots and live timeline updates.
  * **Negative:** Stateful WebSocket connections require sticky sessions or a Redis adapter when horizontally scaling NestJS instances.
* **Implementation notes (24 Oct 2026):**
  * **Client:** `useWebSocket` retries with capped exponential backoff (`backoff.ts`: 1 → 2 → 4 → 8 → 16 s, ±20% jitter, max 30 s) for 5 attempts, then shows *Offline* with a Retry button. The `online` event and the tab becoming visible start a fresh retry budget. Unmounting no longer triggers a reconnect.
  * **Data:** `LiveEventsContext` loads `GET /api/events` (web types now mirror the API: one timeline with `updates[]`) and **refetches on every (re)connect**, so updates missed while offline are filled in. Pushed updates are deduped by id. The socket is open only while `/live` is mounted.
  * **Fallback:** the last good list is cached in `localStorage` (`ht_timeline_live_v1`) and shown when the API is unreachable.
  * **Socket URL:** `NEXT_PUBLIC_WS_URL`, or derived from `NEXT_PUBLIC_API_URL` (`http://host:4000/api` → `ws://host:4000/ws/events`).
  * **Gateway:** 30 s ping/pong heartbeat drops half-open sockets; browser connections whose `Origin` fails the CORS policy (`isAllowedOrigin`) are closed with 1008.
  * **Posting:** `POST /api/events` requires `Authorization: Bearer $EVENTS_ADMIN_TOKEN`. Without a token it is open in development and returns 403 in production. Body is validated (message 1–1000 chars, importance in the allowed set).
  * **Scaling:** see the scale-out note below.
* **Scale-out (25 Oct 2026):** updates go through an `EventBus`. With `REDIS_URL` set, Redis pub/sub fans each update out to every API instance, so no sticky sessions are needed for delivery (a client still reconnects to any instance and resyncs via `GET /api/events`). Without it the bus is in-memory (single instance).

---

## ADR-006: Offline-First Reading & Background Bookmark Sync Architecture

* **Status:** Accepted
* **Context:** Mobile commuters and researchers frequently read on unstable connections (subways, flights) and expect instant startup, offline access to saved articles, and reliable bookmarking that syncs when connectivity returns.
* **Decision:**
  1. Deploy a 5.9 KB Service Worker (`/apps/web/public/sw.js`) initialized via `PWAInitializer.tsx` with split caching strategies:
     * **Cache-First** for static UI assets, fonts (`Playfair Display`, `IBM Plex`), and icons.
     * **Network-First** with automatic cache fallback for `/api/*` news and summary payloads.
  2. Implement offline bookmark queuing via `requestBackgroundSync(tag)` on Web/PWA (and `expo-sqlite` + `@react-native-community/netinfo` on native builds), reconciling local state against `PUT /api/bookmarks` using an atomic Prisma `$transaction` upsert when connectivity is restored.
  3. Enforce strict security policies: exclude sensitive user profile data from public offline caches, sanitize ingested article/RSS HTML, and serve `/sw.js` under strict Content Security Policy (CSP) headers over HTTPS.
* **Consequences:**
  * **Positive:** Enables uninterrupted offline reading and zero-data-loss bookmarking while supporting native home-screen installation (`manifest.json`).
  * **Negative:** Requires rigorous cache-version cleanup logic in `sw.js` (checking every 60 seconds) to prevent stale UI assets after deployments.
* **Implementation notes (24 Oct 2026):**
  * **Identity:** until ADR-007 accounts exist, bookmarks belong to an anonymous per-device UUID (`app/lib/device.ts`, `ht_timeline_device_v1`). The API accepts a UUID or the legacy `local` and rejects anything else. The server copy is therefore a per-device backup; on sign-in (ADR-007) the client will merge its set into the account, with no change to the outbox.
  * **Outbox (`app/lib/bookmark-sync.ts`):** the device is the source of truth. Any change marks the full set pending (`ht_timeline_bookmark_sync_v1`) and sends one idempotent `PUT /api/bookmarks` after a 1 s debounce, one request at a time. Triggers: change, app start, `online`, tab visible, and Capacitor `resume`. Offline errors stay pending and call `requestBackgroundSync('sync-bookmarks')`. 4xx stops retrying until the set changes; 5xx retries on the next trigger.
  * **Background Sync:** the pending request is also written to Cache Storage (`ht-outbox` → `/__outbox/bookmarks`), so the service worker's `sync` handler can send it with the page closed and tell open pages (`bookmarks-synced`). This is Chromium-only; Safari and the iOS/Android WebViews rely on the page triggers above. The server side is the existing atomic `$transaction` in `NewsStore.putBookmarks`.
  * **Service worker (`public/sw.js`, v3):** registered as `/sw.js?api=<API origin>`, and only that origin's `/api/*` counts as API.
    * Pages: network-first → cached page → `/offline.html`, so a deploy shows up at once.
    * `/_next/static`, fonts, icons: cache-first (content-hashed).
    * API GETs: network-first with a 6 s timeout, then cache, for an allowlist (`feed`, `articles`, `timeline`, `topics`, `trending`, `breaking`, `summaries`, `events`), capped at 200 entries. Bookmarks, health and feed config are never cached.
    * Old caches are deleted on activate, and the 60 s update check is kept.
  * **Offline reading:** saved articles are full snapshots in `localStorage` and open without a network, along with the last feed and timelines from the API cache.
  * **Sanitization:** RSS text is tag-stripped at ingest (`rss.service.ts`), and React escapes all article text. The only raw HTML is the app's own theme boot script.
  * **CSP:** production builds ship a `<meta>` CSP (`app/lib/csp.ts`): `default-src 'self'`, `connect-src` limited to the API and socket origins, `object-src 'none'`, `base-uri 'self'`. `'unsafe-inline'` scripts are required by Next's static export.
  * **Headers to set once hosting is chosen:** `Content-Security-Policy` (same policy plus `frame-ancestors 'none'`), `Cache-Control: no-cache` for `/sw.js`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
  * **Native:** the Capacitor shell (Path A) uses the same outbox; the service worker is skipped there. `expo-sqlite` / NetInfo apply only to the React Native Path B.

---

## ADR-007: Tiered Freemium & B2B Team Subscription Monetization Architecture

* **Status:** Proposed
* **Context:** The platform serves four distinct segments—casual news readers, avid power users, journalists, and institutional researchers—and targets high engagement benchmarks (**> 8 minutes per session**, **> 3 articles read**, **> 15% bookmark save rate**, and **> 60% weekly active return rate**).
* **Decision:**
  1. Structure access control around three subscription tiers mapped to Phases 1–4 capabilities:
     * **Free Tier (Reader):** Chronological Timeline Feed, Breaking News Banner, Category Filter Chips, Basic Search, and local bookmarks (Phases 1–2).
     * **Pro Tier ($8–$12/mo — Power Users):** Cloud-synced Bookmarks (`PUT /api/bookmarks`), AI-Generated Topic Summaries, Side-by-Side Source Comparison (`left`/`center`/`right` bias & sentiment), Custom RSS Feed Ingestion, Offline Mode, and PDF/Email digest exports (Phases 3–4).
     * **Newsroom / Team Tier ($25–$49/seat/mo — Journalists & Researchers):** Real-time WebSocket Live Event Timelines with critical alerts, team collaboration on live events, unlimited custom RSS feeds, and historical archive search.
  2. Supplement recurring subscriptions with non-intrusive native sponsor cards in the feed/email digests and publisher referral affiliate links on outbound `SourceComparison` and `ArticleDetail` links.
* **Consequences:**
  * **Positive:** Aligns compute-intensive features (custom RSS polling, AI summaries, real-time WebSockets) with paying Pro and Team subscribers while keeping the core timeline free to drive top-of-funnel organic growth.
  * **Negative:** Requires adding role-based access control (`FREE`, `PRO`, `TEAM`) guards and billing webhook handlers to the NestJS backend.

---

## ADR-008: Multi-Source News Ingestion — Search API + RSS Archive + GDELT History (amends ADR-003)

* **Status:** Proposed (provider choice and budget pending)
* **Date:** 24 Oct 2026
* **Context:**
  * The core product promise is: *search any story → see what happened from the beginning to now*. That needs **(a)** fast, query-based search of recent/live coverage and **(b)** deep history for long-running stories.
  * ADR-003 made the **GDELT DOC 2.0 API** the primary source. In practice (verified during ADR-001 implementation, see `docs/CHANGE_LEDGER.md`):
    * A search for *"MLB World Series 2026"* returned **0 results** (`degraded: true`) — GDELT failed to answer in time, and the home feed was empty because background ingestion was being rate-limited (`HTTP 429`).
    * GDELT enforces **1 request / 5 s per IP**, responds in **15–50 s** for wide windows, and the DOC API only covers a **rolling 3 months** — it can never reach the *beginning* of a long story (e.g. a multi-year conflict).
    * The API also has **no persistent storage in use** (in-memory fallback, `DATABASE_URL` unset), so every story is re-fetched and nothing accumulates.
  * Constraints: low budget, all third-party keys must stay **server-side** (the Capacitor app bundle is public — ADR-001), and sources must permit commercial use.
* **Decision:** Replace the single-source model with **four layers, each with one job**, behind a common `NewsProvider` interface in `apps/api/src/ingestion/providers/`:
  1. **Recent & live search → commercial News Search API (new primary for `/api/timeline` "now" end).**
     * Called only from NestJS; key in server env; results normalized to `ArticleRecord` and persisted.
     * **Default candidate: TheNewsAPI** — lowest-cost paid tier with historical search on all plans.
     * **Alternative: GNews** — includes an archive back to 2020 on paid plans; higher entry price.
     * **Not chosen: NewsData.io** (archive access starts at ~$200/mo), **NewsAPI.org** (free plan is localhost-only/delayed; paid plan is expensive).
     * Provider-agnostic adapter, so the vendor can be swapped without touching controllers or the UI.

     | Provider | Free tier | Entry paid tier (Oct 2026, verify before purchase) | History |
     | :--- | :--- | :--- | :--- |
     | TheNewsAPI | 100 req/day, 3 articles/req, non-commercial | **$19/mo** — 2,500 req/day, 25 articles/req (Standard $49/mo — 10k req/day) | Included on all plans; depth not published |
     | GNews | 100 req/day, 12 h delay, 30 days, non-commercial | €49.99/mo — 1,000 req/day | Back to 2020 on paid plans |
     | NewsData.io | 200 credits/day, 12 h delay, no archive | $199.99/mo — 6 months archive | 6 mo → 5 yr by tier |

  2. **Continuous flow & our own archive → curated publisher RSS** (AP, Reuters, BBC, ESPN, The Guardian, NPR, etc.), polled every 5–15 min by the existing `RssService` parser and **stored in PostgreSQL**. Free, real-time, licence-clean (headline + excerpt + link only). Over time **our database becomes the history**.
  3. **Deep history ("from the beginning") → GDELT via BigQuery** (ADR-003 Pipeline B, currently a stub). Partition-pruned GKG/Events queries back to 2015, run **asynchronously** for a story's older range, within the 1 TB/month free tier. GDELT DOC is kept only as a **short-window (≤ 1 week) discovery fallback**, never a blocking 3-month query.
  4. **Story skeleton → Wikimedia APIs** ("Timeline of …" articles, Current Events portal) to anchor major milestones; news articles fill the gaps between them.
* **Request flow for `GET /api/timeline?q=`:**
  1. Return **stored + News-API results for the recent window first** (target < 2 s).
  2. Kick off background backfill (BigQuery/GDELT older ranges, Wikimedia milestones); persist results; push them to the open page (WebSocket channel from ADR-005) or let the client poll.
  3. Every fetched article is **upserted into PostgreSQL**, deduplicated by URL/headline (existing `dedupeChronological`), and linked to a `storyKey` so repeated searches are instant and timelines grow richer.
* **Implementation progress (24 Oct 2026):** steps **1, 2 and 4 done**.
  * Step 1: Postgres, `Story` / `StoryArticle` (see ADR-002 notes).
  * Step 2: `NewsProvider` in `apps/api/src/ingestion/providers/` (`gdelt-doc`, `rss`), with `NewsSearchService` fanning story queries out to providers. GDELT DOC uses `timespan=1w` and fails fast while cooling down after a 429. The timeline deadline dropped from 50 s to 15 s.
  * Step 4: 23 curated feeds (`apps/api/src/rss/curated-feeds.ts`, all 10 categories), polled every 10 min with ETag/Last-Modified, tracking-param URL normalization (same sha1 id scheme as GDELT) and per-feed failure backoff. User feeds are polled too, behind an SSRF guard. Story timelines search this archive (word-based, one word may be missing for 3+ word queries).
  * Remaining: step 3 (News Search API; provider and budget decision pending), step 5 (BigQuery history), step 6 (Wikimedia milestones).
* **Implementation steps (in order):**
  1. Enable PostgreSQL (`docker compose up -d`, `DATABASE_URL`), run Prisma migrations, persist story results (add `Story` / `StoryArticle` tables).
  2. Introduce the `NewsProvider` interface; port GDELT DOC onto it with ≤ 1-week windows.
  3. Add the News Search API adapter (TheNewsAPI first) + server-side quota guard and per-query cache.
  4. Seed and schedule curated RSS feeds into the store.
  5. Implement BigQuery Pipeline B for async history backfill.
  6. Add Wikimedia milestone extraction.
* **Consequences:**
  * **Positive:** Searches like *"MLB World Series 2026"* return recent results in seconds; no single upstream outage empties the app; history accumulates in our own DB; vendors are swappable; all keys stay off the client.
  * **Negative:** Introduces a recurring cost (≈ $19–$49/mo at launch) and per-day request quotas that need caching and monitoring; more moving parts (4 sources, background jobs, a real database); licence terms must be respected — store only headline, excerpt, link and metadata, never full article bodies, unless a source explicitly allows it.
  * **Rejected alternatives:** *Web crawling* (brittle, paywalls, ToS/legal risk, high ops cost — revisit only for full text from sources that allow it); *Google News RSS search* (not an official API, commercial use unclear); *GDELT-only* (rate limits and 3-month DOC window make the core promise impossible).
* **Sources (pricing checked Oct 2026):** [TheNewsAPI pricing](https://www.thenewsapi.com/pricing), [GNews pricing & limits](https://apiterms.com/api/gnews.io/), [NewsData.io comparison](https://newsdata.io/blog/news-api-comparison/), [Best news APIs 2026](https://thunderbit.com/blog/best-news-apis-compared).

---

## ADR-009: Region-Aware Feed Selection (extends ADR-008)

* **Status:** Proposed
* **Date:** 24 Oct 2026
* **Context:**
  * ADR-008 layer 2 seeds curated publisher RSS (`apps/api/src/rss/curated-feeds.ts`). The list was US/UK-centric until Times of India feeds were added on 24 Oct 2026 for Indian news. Every user sees the same global feed, so an Indian reader gets Indian stories only by chance of recency.
  * Region cannot be bolted on in the UI: articles carry no region, feeds are not tagged, and `/api/feed` ranks only by category and date.
  * Constraints: location is personal data, ingestion is shared and polled once for all users (ADR-008), RSS is national rather than city-level, and LLM prompts must not carry user data (ADR-004).
* **Decision:**
  1. **Ingest globally, select at read time.** All curated feeds keep being polled once. Per-user fetching is rejected: it multiplies polling and fragments the shared archive.
  2. **Tag by region.** Add `region` (ISO 3166-1 alpha-2, or `GLOBAL`) to `CuratedFeed` and `RssFeed`, copied to `Article.region` on ingest. For example, Times of India is `IN`, BBC and the Guardian `GB`, NPR and ESPN `US`, Al Jazeera and NASA `GLOBAL`. Migration backfills existing rows from their feed. GDELT articles use `sourcecountry` where present.
  3. **The unit is country, not city.** National feeds cannot be filtered by city. City-level local news (for example TOI city feeds) is an optional later extension via a `city` tag on feeds.
  4. **Where the user's region comes from, in order:** (a) explicit setting in the app; (b) device or browser locale (`Accept-Language` region / `Intl`); (c) a coarse country-level IP lookup, never precise geolocation and never prompting for permission. The result is stored as a user preference (local storage, or the account once ADR-007 accounts exist) and sent as `?region=IN` to `/api/feed` and `/api/timeline`.
  5. **Boost, don't filter.** `/api/feed` ranks the user's region and `GLOBAL` first, within the existing category and date ordering. Other regions stay reachable, so the app does not become a filter bubble. A "Region" control in settings lets the user change or clear it. The default with no region is today's behaviour.
  6. **Privacy.** IPs are used only for the lookup and never logged or stored. Region is not included in LLM prompts or summary cache keys (ADR-004); summaries stay global.
* **Implementation steps (in order):**
  1. Add `region` to `CuratedFeed`, `RssFeed` and `Article` (Prisma migration plus backfill); tag all curated feeds.
  2. Accept an optional `region` on `/api/feed` and add the region boost to the store query and in-memory fallback, with tests.
  3. Web: region setting, locale-based default, pass the parameter from `NewsContext`.
  4. Optional: coarse IP fallback and city-level feeds.
* **Consequences:**
  * **Positive:** Indian users see Indian news first without extra polling; shared archive and caching are unchanged; no new third-party service in steps 1–3; opt-out is trivial.
  * **Negative:** A schema change and backfill; region tags on feeds are maintained by hand; locale is only a proxy for location (travellers, VPNs), hence the explicit setting; boosting adds a ranking rule that needs tuning.
  * **Rejected alternatives:** *Per-user ingestion* (cost and archive fragmentation); *hard filtering by region* (filter bubble, hides global stories); *precise GPS or city geolocation* (permission friction and sensitive data for little gain with national feeds).
