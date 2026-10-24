# Changelog & Implementation Ledger

All notable changes and architectural transitions for the **News Timeline** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned & In Progress
- **Native Mobile Packaging (ADR-001 Path A):** Finalize Ionic Capacitor configuration and build workflows for iOS (`.ipa`) and Android (`.aab`/`.apk`).
- **Cloud LLM Pipeline Integration (ADR-004):** Replace the backend deterministic heuristic summarizer with Gemini 2.5 Flash-Lite / Flash tier LLM prompts for structured JSON topic synthesis and key point extraction.
- **WebSocket Exponential Backoff (ADR-005):** Upgrade `useWebSocket.ts` to compute true exponential backoff (`reconnectInterval * 2^attempts`) up to 5 retries.
- **Background Bookmark Sync Trigger (ADR-006):** Connect client bookmark mutations in `FeedContext.tsx` to `requestBackgroundSync('sync-bookmarks')` and reconcile against `PUT /api/bookmarks`.
- **Freemium & Team Monetization (ADR-007):** Implement subscription tier guards (`FREE`, `PRO`, `TEAM`), Stripe billing webhooks, and sponsored feed cards.
- **Comprehensive Test Suite:** Replace empty `expect(true).toBe(true)` placeholder tests in `apps/web/__tests__/phase4.test.ts` with functional integration assertions.

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

## Appendix: Architecture Decision Records (ADR) Compliance Ledger

Audit tracking against the 7 ADRs defined in [`docs/adr/architecture_decision_records_adrs.md`](adr/architecture_decision_records_adrs.md):

| ADR ID | Title | Status | Baseline Compliance | Current Compliance | Current State & Remaining Work |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **ADR-001** | Pivot to Mobile-First Web & Native Mobile Architecture | Accepted | 45% | **80%** | Single-column mobile layout, bottom tabs, all 6 routes, and overlay detail implemented. Capacitor native shell (Path A) packaging remaining. |
| **ADR-002** | Backend Framework: NestJS, Prisma & PostgreSQL | Accepted | 80% | **100%** | Migrations committed, Postgres is the read path (indexed feed queries), pooling params documented, memory fallback kept. Production PgBouncer/`directUrl` is a deploy-time config step. |
| **ADR-003** | Global News Ingestion via GDELT & Custom RSS | Accepted | 75% | **85%** | GDELT DOC 2.0 rate-limited 2-pass ingestion and RSS parsing active. GCP BigQuery pipeline remains a stub. |
| **ADR-004** | AI Topic Summarization & Source Comparison Pipeline | Accepted | 45% | **50%** | UI cards, comparison views, and cron scheduling in place. Real LLM inference (Gemini 2.5 Flash-Lite) pending. |
| **ADR-005** | Real-Time Live Event Streaming with WebSockets | Accepted | 55% | **60%** | Gateway and controller active; `/live` route now mounts `LiveEventTimeline`. Exponential backoff algorithm pending in `useWebSocket`. |
| **ADR-006** | Offline-First Reading & Background Bookmark Sync | Accepted | 60% | **65%** | Service worker, cache fallback, and `ht_timeline_saved_v2` storage active. `PUT /api/bookmarks` now persists story-article bookmarks too. Background sync API call from frontend pending. |
| **ADR-007** | Tiered Freemium & B2B Team Monetization | Proposed | 0% | **0%** | Proposed only; no implementation started. |
| **ADR-008** | Multi-Source News Ingestion (amends ADR-003) | Proposed | 0% | **~15%** | Step 1 done (Postgres enabled, `Story`/`StoryArticle` persistence). Steps 2–6 and the provider/budget decision pending. |

**Overall Platform Implementation:** **~63%** across ADR-001–007 (was ~61%; initial audit baseline 51%).

  ### 2026-10-24 · ADR-008 proposed — Multi-source news ingestion
  • Trigger: searching "MLB World Series 2026" returned 0 items (`degraded: true`); home feed empty because GDELT ingestion
    was rate-limited (429). Direct GDELT 1-week query worked but took ~15s; 3-month queries time out/fail.
  • Added ADR-008 to docs/adr/architecture_decision_records_adrs.md (status: Proposed, amends ADR-003): News Search API for
    recent/live (default candidate TheNewsAPI, alt GNews), curated RSS → PostgreSQL as our own archive, GDELT BigQuery for
    deep history, Wikimedia for milestones; GDELT DOC demoted to ≤1-week discovery fallback.
  • Pending decision: provider + monthly budget. No code changes yet.
  • Housekeeping since Phase 4 (Phase 5 entry still to be written): docs moved into docs/ (adr/, planning/, phases/);
    Nx TUI disabled in nx.json; service worker now registers only in production (dev ChunkLoadError fix).
