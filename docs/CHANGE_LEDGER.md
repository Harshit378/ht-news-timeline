# Changelog & Implementation Ledger

All notable changes and architectural transitions for the **News Timeline** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned & In Progress
- **Native Mobile Packaging (ADR-001 Path A):** Finalize Ionic Capacitor configuration and build workflows for iOS (`.ipa`) and Android (`.aab`/`.apk`).
- **Per-user LLM quotas (ADR-004, needs ADR-007):** replace the global daily token cap with per-tier quotas once accounts exist.
- **Hosting headers (ADR-006 follow-up):** apply the documented CSP / HSTS / `sw.js` cache headers once a web host is chosen.
- **Freemium & Team Monetization (ADR-007):** Implement subscription tier guards (`FREE`, `PRO`, `TEAM`), Stripe billing webhooks, and sponsored feed cards.

### ADR-008 step 6 — Wikipedia milestones on story timelines · 2026-10-25
- `ingestion/wikimedia.ts` (pure): wikitext cleaning (refs, nested templates, file links with nested captions), date parsing (`24 February 2022`, `February 24, 2022`, year-less dates with the year from a parent heading) and extraction for the common timeline layouts — date headings → first sentence(s) beneath; dated bullets; prose opening "On <date>, …"; hub pages whose sections only point to a dated sub-timeline (`{{Main|… (7 October 2023 – …)}}`) → section title on its start date. Reference / See also / Notes sections and their subsections are skipped. `spreadMilestones` dedupes and samples ≤ 40 events evenly across time.
- `WikimediaProvider` (search-only `NewsProvider`, id `wikipedia`): MediaWiki search for "timeline of <query>", first "Timeline of …" title sharing a word stem with the query ("Russia Ukraine" ~ "Russo-Ukrainian"), then `action=parse` wikitext. 24 h cache per query. User-Agent includes `WIKIMEDIA_CONTACT` when set; `WIKIMEDIA_MILESTONES=off` disables it.
- `Article.kind` (`report` | `milestone`, migration `20261024183642_article_kind`); milestones are stored as story-only articles with a unique section URL (`…/wiki/Title?ht=<id>#Section`) and serialized with `kind`.
- Milestones are kept out of AI brief input, source comparison and the story's report/source counts. `/story` renders them as gold diamond "Milestone" nodes with "From Wikipedia · CC BY-SA" links.
- Tests: `wikimedia.spec.ts` (dates, cleaning, the four layouts, sampling, stem matching, record shape, provider page choice / cache / no match / off) and a brief test that milestones are excluded. `pnpm test` 147/147.
- Live (temporary API instance on :4105 against the dev DB): "Gaza war" → Timeline of the Gaza war, 14 milestones from 2023-10-07 "Initial attacks"; "Russia Ukraine invasion" → Timeline of the 2022 Russian invasion of Ukraine, 40 milestones from 2022-02-24.
- Not checked in the browser: the dev API on :4000 (under `pnpm dev:all`) stopped during this workstream — most likely when `prisma migrate` regenerated the client under the running process — and needs a restart. The `/story` milestone styling is type-checked and linted only.

### ADR-008 step 3 — News Search API adapter (off by default) · 2026-10-25
- Added `ingestion/providers/news-search-api.provider.ts` (`NewsSearchApiProvider`, id `news-api`) in TheNewsAPI's `/v1/news/all` format. No provider is committed to: it stays disabled until `NEWS_API_KEY` is set (`NEWS_API_BASE_URL` overrides the endpoint for a compatible vendor).
- Records use the shared sha1-of-normalized-URL id (cross-source duplicates collapse); vendor categories map to ours both ways.
- Quota: `NEWS_API_DAILY_LIMIT` requests per UTC day (default 100, the free tier), counted in a new `ProviderUsage` table (migration `20261024183411_provider_usage`) via `UsageTracker`, so restarts don't reset it. Over quota the provider returns nothing instead of failing, so story search is not marked degraded.
- 15-minute per-query cache (200 entries). Errors are reported as `HTTP <status>`; the token-bearing URL is never logged.
- `NewsProvider.enabled` added; `NewsSearchService` skips disabled providers. `ProviderStatus.state` gains `disabled`. `/api/health` lists `news-api` (disabled, or `quota: {used, limit}` when on).
- `.env.example` documents the new settings from this and the previous workstreams (Anthropic, token cap, `EVENTS_ADMIN_TOKEN`, `REDIS_URL`, News API).
- Tests: `news-search-api.provider.spec.ts` (record mapping, disabled without key, params, cache, quota → not degraded, no token in errors, skipped when disabled). `pnpm test` 135/135.
- Live: `/api/health` shows `news-api: disabled`; `/api/timeline?q=world series` still answers from RSS + GDELT. Not exercised against the real vendor (no key).

### Tests — placeholder suite replaced · 2026-10-25
- Deleted `apps/web/__tests__/phase4.test.ts` (48 `expect(true).toBe(true)` placeholders). What it named is now covered by real tests: live events (`live-events.test.ts`), PWA/bookmark sync (`bookmark-sync.test.ts`), source comparison (`source-comparison.test.ts`), and the AI-summary and RSS client services (new `feature-services.test.ts`, which records requests through a stubbed axios adapter).
- **Bug fixed while writing them:** `features/ai-summaries/summaryService.ts` had its own axios client with `NEXT_PUBLIC_API_URL + '/api/summaries'`, so with the documented `…/api` base URL it requested `/api/api/summaries`. It now uses the shared `api` client. `rssService.getRSSItems` called `/rss/feeds/:id/items`, a route the API doesn't have, and was unused — removed. Feed ids are now URL-encoded.
- `vitest.config.ts`: added the web app's `@/` alias (so web modules can be tested directly) and dropped `globals: true`, which only the placeholder file needed.
- `pnpm test`: 128/128 real tests (the earlier 172 included the 48 placeholders).

### ADR-004 — Source comparison on story timelines · 2026-10-25
- Story briefs with ≥ 3 sources now also ask the model for `commonThemes` (2–4) and `differences` (`{source, point}`, ≤ 4) in the same call (`STORY_COMPARE_SCHEMA`, extra prompt rules in `summary-prompt.ts`). No extra LLM call, same input hash and cache.
- `validateComparison` keeps only differences that name a source actually in the input (case-insensitive match back to the real name), so the model can't invent outlets.
- Stored in a new nullable `TopicSummary.comparison` JSON column (migration `20261024182922_story_comparison`). An empty comparison is stored when the model gave none, so it isn't retried on every view; briefs written before this change are upgraded once.
- `GET /api/timeline/brief` returns `brief.comparison`.
- Web: the never-mounted `features/source-comparison/SourceComparison.tsx` was rewritten (app tokens, mobile layout, 44px targets) and now shows under the brief on `/story`: shared themes, then each outlet with what sets it apart, its latest report and earlier ones (tap opens the article). `buildComparison` (pure) joins the story items with the AI data.
- Tests: comparison prompt/schema, `validateComparison`, brief service (asks only with 3+ sources, upgrade-once), `apps/web/__tests__/source-comparison.test.ts`. `pnpm test` 172/172.
- Live check with Ollama `llama3.2`: `/story/?q=Ukraine` (11 reports, 8 sources) got 3 shared themes and 4 per-source differences, rendered under the brief. With the 3B model several "differences" are close to the outlet's own headline; a cloud model (ADR-004 Claude provider) should do better.

### ADR-004 — Claude provider + daily token cap · 2026-10-25
- Added `apps/api/src/llm/anthropic.provider.ts` (`@anthropic-ai/sdk`), selected with `LLM_PROVIDER=anthropic`. Defaults to `claude-haiku-5-5` (`ANTHROPIC_MODEL` overrides) at effort `low` (`ANTHROPIC_EFFORT`). The request's JSON schema goes in `output_config.format` (structured outputs); `max_tokens` has a 4096 floor because thinking tokens count against it; no `temperature`. Credentials: `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` or an `ant auth login` profile.
- Error mapping: auth / rate limit / 5xx / timeout / network → `LlmUnavailableError` (callers fall back as with Ollama); 400 → `LlmOutputError` and logged; `refusal`, `max_tokens` and invalid JSON → `LlmOutputError`. `/api/health` shows a rejected key until a call succeeds, and today's token use.
- `TokenBudget` (`llm/token-budget.ts`): global daily ceiling `LLM_DAILY_TOKEN_LIMIT` (default 2,000,000 input+output tokens, UTC day, `0` = unlimited). Once used, calls stop and the existing fallbacks apply. Per-user quotas still wait for ADR-007.
- `SUMMARY_SCHEMA` now sets `additionalProperties: false` (required by structured outputs; Ollama unaffected).
- Tests: `anthropic.provider.spec.ts` (structured-output params, model/effort overrides, error mapping, status after a rejected key, budget stop, provider selection, day rollover). `pnpm test` 163/163.
- Not verified against the real API: no Anthropic credentials on this machine. The dev API still runs on Ollama (`/api/health` → llama3.2 ok).

### ADR-005 — Multi-instance fan-out via an event bus · 2026-10-25
- Added `apps/api/src/events/event-bus.ts`: `EventBus` with `InMemoryEventBus` (default) and `RedisEventBus` (`ioredis`, used when `REDIS_URL` is set). `EventsController` publishes to the bus; `EventsFanout` delivers bus messages to this instance's `EventsGateway.broadcast`. Every instance, including the publisher, receives each update once from Redis.
- If Redis is down or a publish fails, the update is delivered locally only, with a warning, instead of being lost. The subscriber connection re-subscribes on reconnect.
- `docker-compose.yml`: `redis` service under the `scale` profile (`docker compose --profile scale up -d`).
- Tests: `event-bus.spec.ts` (two instances over a fake Redis receive one copy each; fallback when Redis is down or publish throws; other channels and malformed messages ignored; in-memory default). `pnpm test` 154/154.
- Live check: against the running dev API (in-memory bus), a `POST /api/events` reached a connected WebSocket client. Not run: two instances over a real Redis, because neither Docker nor Redis is installed on this machine.

### ADR-004 — AI story briefs & topic summaries via `LlmProvider` (Ollama first) · 2026-10-24

#### Added
- **`LlmProvider` interface** (`apps/api/src/llm/`), chosen with `LLM_PROVIDER` (default `ollama`; `none` disables it):
  - `OllamaProvider` calls `/api/chat` with structured output (`format` = JSON schema), `stream:false`, `keep_alive: 30m` and temperature 0.2, and runs one generation at a time.
  - `DisabledProvider` is used for `none` or unknown values.
  - Cloud providers plug in as one new class.
- **Story briefs:** a "What happened" paragraph and 3–5 key points at the top of every story timeline, written from up to 20 reports.
  - Reports are picked newest first, round-robin across sources, with repeated headlines skipped.
  - `StoryBriefService` generates in the background on first view, never on the request path. It needs at least 3 reports from 2 sources, runs once per story at a time, keeps a brief at least 30 min, and backs off 5 min after a failure.
  - Briefs are cached in `TopicSummary` (`kind='story'`, keyed by the timeline key), and the input hash prevents rewriting unchanged input.
- `GET /api/timeline/brief?q=&category=` → `{ status: ready | pending | unavailable, brief? }`.
- **Prompt and validation** (`summary-prompt.ts`, `summary-validate.ts`):
  - Prompts carry headline, source, date and a 300-char excerpt only, oldest first.
  - Report text is treated as untrusted and kept inside a `<reports>` block.
  - The model is told to use only stated facts and to note disagreement between sources.
  - The output is normalised and length-capped, with one retry on unusable output.
- Migration `20261024171223_llm_summaries`: `TopicSummary.kind`, `inputHash`, `model`.
- `/api/health` reports `llm: { id, model, state, detail }` (Ollama `/api/tags`, cached 30 s; tells you if the model isn't pulled).
- **Web:** `StoryBrief` panel on the story page. It shows a skeleton and "Writing a summary…" while it polls every 3 s for up to ~2 min, then the paragraph and key points labelled "AI summary of N reports from M sources · model · may contain errors". When unavailable it renders nothing.
- `.env.example`: `LLM_PROVIDER`, `OLLAMA_URL`, `OLLAMA_MODEL`, `LLM_TIMEOUT_MS`.
- Tests for the Ollama provider, prompt, validator, brief service, topic summaries and timeline wiring. **114/114 passing.**

#### Changed
- Topic summaries (`SummariesService`) are written by the LLM. The previous headline heuristic is the fallback when the LLM is down or disabled, and is saved with `model='heuristic'`. The 4-hourly cron skips topics whose input hasn't changed.
- `/api/summaries` lists topic summaries only (story briefs are read by key).
- The web timeline request timeout dropped from 60 s to 30 s (the API's story deadline has been 15 s since ADR-008).

#### Verified (llama3.2 3B, 8 GB Mac)
- "MLB World Series 2026": the timeline answered in about 4 s and the brief was ready about 34 s later (first call loads the model). A repeat view is served from the DB in under 1 ms with no LLM call. Facts checked against the stored reports:
  - Present in the reports: the 3-2 score, the 103.5 mph pitch, "best-of-seven", "first title".
  - One key point was an inference not stated in the reports: "first World Series game win since 1982".
- Topic summary (sports) about 10 s.
- Ollama stopped: health shows `down: Ollama not reachable`, the timeline still answers in 34 ms, and the brief is immediately `unavailable` (panel hidden).
- `LLM_PROVIDER=none`: `disabled`; topics use the heuristic.

### Longer article excerpts from RSS · 2026-10-24
- Problem: cards and the detail view showed a single line (e.g. ESPN "World Series Game 1: Takeaways…").
- Feeds now keep up to ~1,000 chars (`MAX_EXCERPT_CHARS`, cut at a sentence end, never mid-word): the longer of `description` / `summary` / `content:encoded`, with "Continue reading…" boilerplate removed. Still excerpt only, never full bodies (ADR-008).
- Re-polls upgrade already-stored rows when the new excerpt is longer (and fill in a missing image), because `createMany` skips existing rows. This also replaces GDELT's title-only excerpts when RSS carries the same URL.
- Measured result (avg chars): Ars Technica 78 → 855, NASA 347 → 853, The Guardian 400 cap → 664, The Verge 337 → 598.
- Not fixable from RSS: BBC, ESPN, Al Jazeera, BBC Sport and NPR only publish 100–200 chars. Next: an AI "story brief" per timeline (ADR-004, Ollama) that synthesizes a paragraph from all sources.
- Note: a one-off reset of `etag` / `lastModified` is needed after changing how feeds are parsed, otherwise 304 responses keep the old text.

### Fix — CORS blocked the web dev server · 2026-10-24
- `nx serve web` runs on `localhost:4200`, but the API only allowed `localhost:3000`, so every browser call failed with "Origin … is not allowed by Access-Control-Allow-Origin" and the story page showed "Couldn't reach the newsroom". Added `apps/api/src/cors.ts` (`isAllowedOrigin`, with tests): outside production any `localhost` / `127.0.0.1` / `[::1]` / private-LAN origin on any port is allowed; in production only `CORS_ORIGIN` and the Capacitor origins are. Requests without an Origin header are unaffected. Restart the API to apply.

### Tooling · 2026-10-24
- Added `pnpm clean` (removes `dist/`, `.next/`, `apps/web/.next`, `apps/web/out`, `tsconfig.tsbuildinfo`) and `pnpm clean:all` (also runs `nx reset`). Documented in `README.md`.

### ADR-008 steps 2 & 4 — `NewsProvider` interface + curated RSS archive · 2026-10-24

#### Added
- **`NewsProvider` interface** (`apps/api/src/ingestion/providers/`) with `gdelt-doc` and `rss` providers registered under the `NEWS_PROVIDERS` token. **`NewsSearchService`** fans a story query out to every searchable provider with a per-provider timeout (25 s) and merges the results; `degraded` is set when any provider fails.
- **Curated RSS ingestion:** 23 publisher feeds covering all 10 categories (BBC, Guardian, NPR, Al Jazeera, Ars Technica, The Verge, NASA, ESPN, BBC Sport), listed in `apps/api/src/rss/curated-feeds.ts` and all verified reachable. `RssIngestionService` seeds them on boot and polls every 10 min, 4 at a time:
  - conditional GET (ETag / Last-Modified → 304)
  - tracking-param URL normalization, with the same sha1 id scheme as GDELT so cross-source duplicates collapse
  - dates clamped to now
  - feeds that fail 5 polls in a row are retried at most hourly
  - user feeds are polled too
- Migration `20261024144748_rss_ingestion`: new `RssFeed` columns `origin`, `source`, `etag`, `lastModified`, `lastItemAt`, `lastError`, `failureCount`.
- **GDELT cooldown breaker:** a 429 pauses GDELT for 2 min, doubling to 15 min. Queued and new requests fail fast with `GdeltCoolingDownError`, with no network call and no queue wait.
- `/api/health` reports `providers[]` (state, cooldownUntil, lastSuccessAt, lastError) and `rss: { active, failing }`.
- Tests: `rss.service.spec.ts`, `rss-ingestion.service.spec.ts`, `news-search.service.spec.ts`, `gdelt-doc.service.spec.ts`, plus search-term cases in `news.store.spec.ts`. **83/83 passing.**

#### Changed
- GDELT DOC is now a fallback (amends ADR-003). Story search makes **one 1-week `HybridRel` request** instead of two 3-month passes, 429s are no longer retried, and category ingestion runs **hourly** instead of every 15 min. On boot, RSS runs first, then GDELT.
- `TimelineController` uses `NewsSearchService` instead of GDELT directly. `STORY_DEADLINE_MS` dropped from 50 s to **15 s**.
- **Archive search is word-based** (`NewsStore.searchArticles`):
  - words can match in any order across headline, excerpt and source
  - bare numbers such as years are ignored
  - queries of 3+ words may miss one word
  - results are ranked by match count, then date

  Result: "MLB World Series 2026" went from 0 items to 12 ESPN stories, answered in about 30 ms while GDELT was cooling down.
- RSS parser: element text is read safely (`#text` objects and CDATA; fixes `"[object Object]"` guids and titles), Atom `rel="alternate"` links are picked, images come from `media:content` (largest), `media:thumbnail`, image enclosures or inline `<img>`, HTML entities are decoded, and up to 50 items are read per feed (was 30).
- `DELETE /api/rss/feeds/:id` on a curated feed disables it instead of deleting it, because seeding would otherwise bring it back. User feeds are still deleted.
- Memory mode keeps only the newest 5,000 articles.

#### Security
- **SSRF guard for server-polled feeds:** the host is resolved and rejected if any address is loopback, private, CGNAT, link-local/metadata (`169.254.169.254`), multicast or reserved, including IPv4-mapped IPv6. Redirects are followed manually (at most 3), and every hop is checked.

#### Notes
- Verified against Postgres: the first poll stored 472 RSS items from 23 feeds in about 2 s with 0 failures. The DB then held 728 articles across all categories, and feeds with validators returned 304 on re-poll.
- A second API instance on the same IP tripped GDELT's limit; the breaker opened and timelines kept answering from the archive.

### ADR-002 completion — PostgreSQL as source of truth (+ ADR-008 step 1) · 2026-10-24

#### Added
- **First Prisma migration** `apps/api/prisma/migrations/20261024134701_init/` (all models plus the new tables below). Root scripts `db:generate`, `db:migrate`, `db:deploy`, `db:status`, `db:studio`; `postinstall` runs `prisma generate`.
- **Story persistence (ADR-008 step 1):** `Story` (unique `key` = sanitized query + `|category`, `firstSeen`/`lastSeen`/`lastFetchedAt`) and `StoryArticle` join tables. `NewsStore.saveStory` / `getStory`.
- **`Article.inFeed`** flag (story-only articles = `false`), `Article.updatedAt`, a unique index on `Article.url`, and indexes `(inFeed, publishedAt DESC)` and `EventUpdate(eventId, timestamp DESC)`.
- `/api/health` now reports `migrations: ok | pending | n/a` and article/story counts.
- Tests: `apps/api/src/store/news.store.spec.ts` (memory-mode story/feed behaviour, bookmark guard). Three new `timeline.controller.spec.ts` cases: fresh stored story skips GDELT, stale story is the GDELT-failure fallback, a persist failure still answers. **66/66 passing.**
- Docs: root `README.md` rewritten from the create-next-app boilerplate (quick start, database, dev, mobile commands); "Database setup" section in `docs/README.md`; ADR-002 implementation notes.

#### Changed
- **`NewsStore` reads from Postgres** when connected. Feed, article, search, trending, breaking, topics, categories and bookmarks are queried on demand instead of bulk-loaded into Maps at boot; only summaries, RSS feeds and live events are cached. Store read methods are now `async`, and their callers were updated (`feed`, `articles`, `search`, `trending`, `breaking`, `topics`, `bookmarks`, `health` controllers and `SummariesService`).
- `GET /api/feed` paginates in SQL (`skip`/`take`, one extra row for `hasMore`) using the `(category, publishedAt DESC)` index (verified with `EXPLAIN`).
- In postgres mode, `/api/search` (and the store matches merged into `/api/timeline`) also covers stored story articles.
- `TimelineController` checks the stored `Story` before calling GDELT, so a story fetched within 15 min is served from Postgres (survives restarts; measured 54 ms). A stale stored story becomes the `degraded` fallback instead of an empty list. GDELT results are persisted and returned under their canonical stored ids.
- `PrismaService` falls back to the in-memory store when the DB is reachable but not migrated (logs "run `pnpm db:deploy`"). `main.ts` enables shutdown hooks.
- Live-event updates use the DB-generated id. Sample live events are seeded into Postgres when the table is empty.
- `.env.example`: quoted `DATABASE_URL` with `connection_limit=10&pool_timeout=20` pool params and PgBouncer guidance.

#### Fixed
- **Bookmarks on story-timeline articles were silently dropped** (`putBookmarks` skipped ids missing from the in-memory feed map). They now persist; ids never seen are returned in a new `missing` field.

#### Notes
- Local DB: Homebrew `postgresql@16` (Docker isn't installed here), role/db `timeline`. The Prisma client auto-loads the root `.env`, so to force memory mode use `DATABASE_URL=` (empty), not `env -u`.
- A live `/api/timeline?q=world series` check returned `degraded` because GDELT answered HTTP 429. The persistence path was verified against the real DB with a scratch script instead (URL dedupe, firstSeen/lastSeen, inFeed promotion, story bookmarks).

---

## [0.2.0] - 2026-10-24

### Mobile-First Single-Column Pivot & NestJS Data Layer Integration (Phases 1–4)

Architectural pivot from a desktop-centric 3-column interface to a mobile-first single-column web and native-ready architecture backed by NestJS and GDELT news ingestion.

#### Added
- **Core Tab Routes & Navigation (Phase 3):**
  - Implemented all 6 primary tab destinations in `apps/web/app/` using export-safe query parameters:
    - `/` (Home Feed): Single-column chronological timeline with date-grouped rails, `PageHeader`, `FilterChips`, and `BreakingBanner`.
    - `/search`: Live debounced (300ms) search hitting `GET /api/search`, recent searches tracking (`lib/recent-searches.ts`), trending topic chips (`GET /api/trending`), and timeline search deep-links.
    - `/story?q=&category=`: Chronological story-tracing timeline view (`components/timeline/StoryTimeline.tsx`) consuming `GET /api/timeline`, sorting oldest-to-newest, auto-calculating day/month buckets (`lib/timeline-grouping.ts`), and supporting offline fallback.
    - `/topics`: 10-category visual grid styled with `CORE_TOPICS` tints and live article counts from `GET /api/topics`.
    - `/live`: Real-time live event dashboard mounting `LiveEventsContext` and `LiveEventTimeline`.
    - `/settings`: Preference center for Dark/Light/System theme toggling, mounted `RSSFeedsManager`, and diagnostic server URLs.
  - Added `app/not-found.tsx` to gracefully redirect legacy `/news/<topic>` URLs to `/story/?q=`.
- **Mobile Shell & Gestures (Phase 2):**
  - Added `AppShell` in `LayoutWrapper` with viewport-safe bottom padding (`env(safe-area-inset-bottom)`) and overlay management.
  - Added touch-first interaction sheet (`hooks/useLongPress.ts` and `shell/ArticleActionSheet.tsx`) supporting long-press actions (Bookmark, Share, Mark Read/Unread) on cards and bookmark rows.
  - Added `shell/ArticleUrlSync.tsx` synchronizing the active article with the `?article=` URL query parameter to support deep linking, browser back, and native Android back navigation.
  - Added shared UI components: `components/timeline/TimelineList.tsx`, `TimelineSkeleton.tsx`, `shell/EmptyState.tsx`, `lib/timeline-grouping.ts`, `lib/native.ts`, and `lib/category-style.ts`.
- **Chronological Story Timeline API (Phase 4):**
  - Added `GET /api/timeline?q=&category=` endpoint in `apps/api/src/rest/timeline.controller.ts` providing chronological multi-source coverage.
  - Added `dedupeChronological` utility to remove duplicate publisher reports across matching URLs or normalized headlines.
  - Added 15-minute query caching (max 200 items) and collapsed concurrent identical GDELT requests.
  - Added `searchStory(q)` in `GdeltDocService` utilizing a two-pass query strategy: Pass 1 (`DateAsc`, 75 records) for origin stories, Pass 2 (`HybridRel`, 175 records) for key developments up to the present.
  - Added `sanitizeStoryQuery` to strip GDELT operators and short words.
  - Added `rememberStoryArticles` LRU cache (5,000 capacity) in `NewsStore` so single-article lookups (`/api/articles/:id`) succeed without polluting the general feed.
  - Added automated test suites: `apps/api/src/rest/timeline.controller.spec.ts` and `apps/web/__tests__/timeline-grouping.test.ts` (11/11 passing via Vitest).
- **Design System Tokens & Brand Assets (Phase 1):**
  - Added runtime CSS variables in `globals.css` mapped to Tailwind `@theme` utilities (`bg-bg`, `text-ink`, `text-muted`, `bg-surface`, `text-gold`, `text-accent`, `--scrim`, `sheet-up`, `.no-scrollbar`).
  - Added `lib/theme-boot.ts` inline script executed in `<head>` to prevent flash of unstyled theme on page load.
  - Added high-resolution PWA and native mobile icon assets: `public/icon-192x192.png`, `public/icon-512x512.png`, and `resources/icon.png` (1024x1024 native source).

#### Changed
- **Data Layer & Backend Migration (Phases 2 & 4):**
  - Migrated `FeedContext` from client-side NewsAPI to the NestJS API client (`lib/api-client.ts`), supporting paginated feed loading, cached offline fallback, and bundled offline mock stories.
  - Upgraded bookmark persistence to `ht_timeline_saved_v2` storing complete article snapshots (with automatic migration from v1 ID lists).
  - Configured CORS in `main.ts` to allow `capacitor://localhost` and `http://localhost`.
  - Refactored `rssService` to share the unified `api-client` instance with consistent `/api` base URL formatting.
- **Article Detail View (Phase 2):**
  - Rebuilt `ArticleDetailPanel` as an overlay-only view with a 200ms `slide-in-right` animation, scroll-tracked 2px accent reading progress bar, Playfair Display typography, gold monospace byline, drop caps, body scroll locking, and a "Trace this story from the beginning" link.
- **Timeline Feed Layout (Phase 2):**
  - Converted `TimelineFeed` to a single mobile-optimized column (`max-w-lg`) with infinite scrolling via `IntersectionObserver`.
  - Restyled all timeline items using design tokens: `NewsCard`, `TimelineDot`, `FilterChips` (44px touch targets), `BreakingBanner`, `BookmarkRow`, and `BottomTabBar`.
- **Theming & Preferences (Phase 1):**
  - Rewrote `ThemeContext` to manage `data-theme="dark|light"` on the root document with user preference persistence (`dark | light | system`, default `dark`).
- **PWA Manifest & Layout Metadata (Phase 1):**
  - Updated `manifest.json` colors, app shortcuts (Feed, Search, Saved), and `layout.tsx` viewport settings (`viewportFit: cover`).

#### Fixed
- **TypeScript Compilation Errors (Phase 1):**
  - Resolved build failures in `FeedContext.tsx:94` and `lib/feed-data.ts:4` where emoji records were missing `health`, `culture`, `sports`, and `opinion` keys by centralizing definitions in `CATEGORY_EMOJI` (`types/article.ts`).
  - Fixed category inference mappings (`health` -> `health`, `sports` -> `sports`, `entertainment` -> `culture`) and removed pseudo-random `Math.random()` breaking news assignments.
- **GDELT Category Ingestion Query Syntax (Phase 4):**
  - Fixed pre-existing bug where GDELT DOC queries failed with syntax error `"Queries containing OR'd terms must be surrounded by ()"`, causing silent 0-article ingestion.
- **GDELT Rate Limiting & Socket Dropping (Phase 4):**
  - Implemented a unified rate-limiting queue enforcing >=5.5s delays between all GDELT requests, prioritised user searches, added 2x retry on HTTP 429 and dropped connections, and surfaced error responses.
- **RSS Parser Atom Link Parsing (Phase 4):**
  - Fixed bug in `rss.service.ts` where Atom `<link href>` objects were converted to string `"[object Object]"`.

#### Removed
- **Legacy Desktop Layout (Phase 2):**
  - Eliminated desktop 3-column splits (`lg:flex-row`, inline 380px sidebar panes) across `TimelineFeed` and `ArticleDetailPanel`.
  - Unmounted floating `<Chatbot />` from global layout to eliminate bottom tab navigation overlap.
- **Third-Party NewsAPI Dependencies & Dead Code (Phases 2 & 3):**
  - Deleted legacy desktop and NewsAPI routes and components:
    - Pages: `news/page.tsx`, `news/[topic]/*`, `sports/*`
    - Components: `header.tsx`, `Timeline.tsx`, `StoryCard.tsx`, `SearchTimeline.tsx`, `TopHeadlinesSection.tsx`, `PinnedTopics.tsx`
    - Hooks & Services: `useNewsOrgArticles.ts`, `useApi.ts`, `services/everythingService.ts`, `services/topHeadlinesService.ts`, `services/newsOrgClient.ts`
    - Data: `types/timeline.ts`, `data/topics.json`
  - Dropped obsolete country/region selection setting that only applied to NewsAPI.

---

## [0.1.0] - 2026-10-24

### Initial Prototype & Baseline Architecture

#### Added
- **Monorepo Setup & Frontend MVP:**
  - Initialized Nx monorepo with Next.js 15.4.4, React 19.1.0, and Tailwind CSS 4 (`apps/web`).
  - Basic timeline feed with date grouping, filter chips, breaking banner, and local storage bookmarks.
  - Initial PWA assets: `manifest.json`, Service Worker (`public/sw.js`), and `PWAInitializer.tsx`.
  - Phase 4 prototype feature modules: `features/live-events`, `features/source-comparison`, `features/ai-summaries`, and `features/rss-feeds`.
- **Backend Service Framework (`apps/api`):**
  - Initialized NestJS 11 backend with `@nestjs/platform-ws`, `@nestjs/schedule`, and Prisma ORM.
  - Configured PostgreSQL 16 service in `docker-compose.yml`.
  - Defined Prisma schema for `Article`, `Bookmark`, `LiveEvent`, `EventUpdate`, `TopicSummary`, and `RssFeed`.
  - Implemented initial REST endpoints: Feed, Articles, Search, Trending, Topics, Breaking, Bookmarks, Events, Summaries, and RSS.
  - Implemented GDELT DOC 2.0 ingestion scheduler and RSS XML/Atom parser service.
  - Implemented WebSocket gateway (`/ws/events`) for live event streaming.

---

### ADR-006 — Offline-first reading & background bookmark sync · 2026-10-24

#### Added
- `apps/web/app/lib/device.ts`: anonymous per-device UUID (`ht_timeline_device_v1`); works without `crypto.randomUUID` (plain-http LAN testing).
- `apps/web/app/lib/bookmark-sync.ts`: `BookmarkSync` outbox — full-set idempotent PUT, 1 s debounce, single-flight with re-send, offline → pending + `requestBackgroundSync`, 4xx stops / 5xx retries, persisted across restarts; Cache Storage outbox for the service worker.
- `FeedContext` exposes `bookmarkSync`; triggers on change, start, `online`, visibility and Capacitor `resume`; listens for the worker's `bookmarks-synced`.
- Saved page status line: "Saved on this device · backed up …" / "will back up when you're online" / backup failed.
- `apps/web/public/offline.html` (was referenced by the worker but missing).
- `apps/web/app/lib/csp.ts` + production-only CSP `<meta>` in `layout.tsx`.
- Tests: `apps/web/__tests__/bookmark-sync.test.ts` (sync engine, device id, CSP), `apps/api/src/rest/bookmarks.controller.spec.ts`.

#### Changed
- `public/sw.js` rewritten (v3): API origin passed at registration; network-first pages with offline fallback; cache-first only for hashed static assets; API allowlist with 6 s timeout and 200-entry cap; bookmarks never cached; real `sync` handler that PUTs the outbox and notifies pages.
- `bookmarks.controller.ts`: `userId` must be a UUID (or legacy `local`), `articleIds` validated and deduped (≤ 1000).

#### Verification
- `pnpm test`: 149/149 passing (18 files). `tsc --noEmit` clean for api and web; eslint clean on changed files.
- The in-app browser pane can't register service workers, so the production build was checked in headless Chrome with a throwaway profile. Setup: a temporary copy of the web app built with `NEXT_PUBLIC_API_URL=http://localhost:4100/api`, served statically on :4300, with a small proxy on :4100 → the dev API so the "API" could be stopped. The temp copy, profile and test bookmark rows were removed afterwards.
  - Worker registered by the app; caches `ht-pages-v3` (8 pages incl. offline page), `ht-static-v3` (hashed chunks, fonts, icons), `ht-api-v3` (`feed`, `events` only).
  - Bookmark → PUT with the device UUID → server held it.
  - API down → second bookmark stayed pending, outbox entry written, Saved page said "will back up when you're online".
  - Both servers down → home feed rendered from the API cache (20 articles), saved article opened, an uncached page showed `offline.html`.
  - API back → on app start the pending set was sent and the server held both; a later removal was sent on the `online` event without a reload.
  - `GET /api/bookmarks?userId=alice` → 400.
- Not exercised: the service worker `sync` event with the page closed (can't be triggered from automation). The code path is reviewed only.

### ADR-005 — Live events over WebSockets with exponential backoff · 2026-10-24

#### Added
- `apps/web/app/features/live-events/backoff.ts`: `reconnectDelay` (1 → 2 → 4 → 8 → 16 s, ±20% jitter, capped at 30 s).
- `apps/web/app/features/live-events/liveEvents.ts`: `parseMessage`, `isUpdatePayload`, `applyUpdate` (dedupe by update id, newest first, takes the pushed status).
- `wsUrl()` and `getLiveEvents()` in `apps/web/app/lib/api-client.ts`; `NEXT_PUBLIC_WS_URL` override.
- `/live` connection badge: Live / Connecting… / Reconnecting… (n/5) / Offline (with Retry, and "showing saved updates" when cached). New updates flash briefly (`live-fresh` keyframe).
- Gateway heartbeat (30 s ping/pong, half-open sockets terminated) and Origin check (close 1008 via `isAllowedOrigin`).
- `POST /api/events` auth (`EVENTS_ADMIN_TOKEN` bearer, timing-safe compare; open in dev, 403 in production without a token) and body validation.
- Tests: `apps/web/__tests__/live-events.test.ts`, `apps/api/src/events/events.spec.ts` (real `ws` server: broadcast reaches a client, bad Origin closed; heartbeat; auth; validation).

#### Changed
- `useWebSocket` rewritten: status (`connecting | open | reconnecting | offline`), retry timer cleared on unmount, no reconnect after a deliberate close, `reconnect()`, `onMessage` / `onOpen` callbacks, wake-up on `online` and `visibilitychange`.
- `LiveEventsContext` now uses the API instead of `MOCK_TIMELINES`, refetches on every socket open (gap fill after reconnect), caches to `ht_timeline_live_v1`, and falls back to the cache when offline. The socket is opened by `useLiveConnection()` on `/live` only.
- Web live-event types aligned with the API (timeline with `updates[]`; nested `LiveEvent[]` removed). `LiveEventTimeline.tsx` renders the update list.

#### Verification
- `pnpm test`: 132/132 passing (16 files). `tsc --noEmit` clean for api and web; eslint clean on changed files.
- Browser (`localhost:4200/live` against the running API): badge "Live"; a `curl -X POST /api/events` update appeared on the open event page immediately. Restarting the API (nx watch) showed "Reconnecting… (1/5)" and was back to "Live" in ~1.2 s, with no console errors.
- Not exercised in the browser: exhausting all 5 retries to "Offline" and the cached-list fallback (covered only by code review). Would require stopping the API for ~30 s.

### Curated RSS — Times of India (Indian news) · 2026-10-24
- Added 10 Times of India feeds to `apps/api/src/rss/curated-feeds.ts` (23 → 33 curated feeds): Top Stories, India, World (`world`); Technology; Business (`finance`); Science; Health & Fitness; Entertainment (`culture`); Sports and Cricket (`sports`). Each returned HTTP 200 with 19–47 items on 2026-10-24.
- Feeds are seeded on the next API boot; no migration. They use the existing ten categories, so there is no UI change.
- Decision: a region-aware feed selection (by the user's city/country) is a separate concern. Written up as ADR-009 (Proposed), not implemented.
- Verification: `pnpm test` 114/114 passing.
- Added ADR-009 (region-aware feed selection) to the ADR index and `docs/adr/architecture_decision_records_adrs.md`: ingest globally, tag feeds/articles by country, derive region from setting → locale → coarse IP, boost rather than filter. Docs only; no code changes.

## Appendix: Architecture Decision Records (ADR) Compliance Ledger

Audit tracking against the 7 ADRs defined in [`docs/adr/architecture_decision_records_adrs.md`](adr/architecture_decision_records_adrs.md):

| ADR ID | Title | Status | Baseline Compliance | Current Compliance | Current State & Remaining Work |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **ADR-001** | Pivot to Mobile-First Web & Native Mobile Architecture | Accepted | 45% | **80%** | Single-column mobile layout, bottom tabs, all 6 routes, and overlay detail implemented. Capacitor native shell (Path A) packaging remaining. |
| **ADR-002** | Backend Framework: NestJS, Prisma & PostgreSQL | Accepted | 80% | **100%** | Migrations committed, Postgres is the read path (indexed feed queries), pooling params documented, memory fallback kept. Production PgBouncer/`directUrl` is a deploy-time config step. |
| **ADR-003** | Global News Ingestion via GDELT & Custom RSS | Accepted (amended by ADR-008) | 75% | **90%** | GDELT DOC behind `NewsProvider` (hourly sweep, ≤ 1-week search, 429 cooldown). Custom and curated RSS feeds polled into Postgres. GCP BigQuery pipeline remains a stub. |
| **ADR-004** | AI Topic Summarization & Source Comparison Pipeline | Accepted | 45% | **95%** | `LlmProvider` with Ollama (default) and Claude Haiku 5.5 (`LLM_PROVIDER=anthropic`, global daily token cap); story briefs, cron topic summaries, and source comparison on `/story`. Remaining: per-user quotas (needs ADR-007). |
| **ADR-005** | Real-Time Live Event Streaming with WebSockets | Accepted | 55% | **100%** | `/live` uses the API + socket with capped exponential backoff (5 retries), resync on reconnect, cached offline fallback; gateway heartbeat, Origin check, authenticated `POST /api/events`; Redis fan-out across instances when `REDIS_URL` is set. |
| **ADR-006** | Offline-First Reading & Background Bookmark Sync | Accepted | 60% | **90%** | Per-device bookmark backup via outbox + Background Sync, service worker v3 (network-first pages, hashed-asset cache, API allowlist cache, offline page), CSP meta. Remaining: host security headers once hosting is chosen; cross-device sync arrives with ADR-007 accounts. |
| **ADR-007** | Tiered Freemium & B2B Team Monetization | Proposed | 0% | **0%** | Proposed only; no implementation started. |
| **ADR-008** | Multi-Source News Ingestion (amends ADR-003) | Proposed | 0% | **~50%** | Steps 1, 2, 4 done (Postgres + Story persistence, `NewsProvider` + 1-week GDELT, 33 curated RSS feeds incl. Times of India). Steps 3 (News Search API, needs a budget decision), 5 (BigQuery) and 6 (Wikimedia) pending. |

**Overall Platform Implementation:** **~76%** across ADR-001–007 (was ~73%; initial audit baseline 51%).

  ### 2026-10-24 · ADR-008 proposed — Multi-source news ingestion
  • Trigger: searching "MLB World Series 2026" returned 0 items (`degraded: true`); home feed empty because GDELT ingestion
    was rate-limited (429). Direct GDELT 1-week query worked but took ~15s; 3-month queries time out/fail.
  • Added ADR-008 to docs/adr/architecture_decision_records_adrs.md (status: Proposed, amends ADR-003): News Search API for
    recent/live (default candidate TheNewsAPI, alt GNews), curated RSS → PostgreSQL as our own archive, GDELT BigQuery for
    deep history, Wikimedia for milestones; GDELT DOC demoted to ≤1-week discovery fallback.
  • Pending decision: provider + monthly budget. No code changes yet.
  • Housekeeping since Phase 4 (Phase 5 entry still to be written): docs moved into docs/ (adr/, planning/, phases/);
    Nx TUI disabled in nx.json; service worker now registers only in production (dev ChunkLoadError fix).
