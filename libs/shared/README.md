# @ht/shared

Platform-free TypeScript shared by `apps/web` (Next.js / Capacitor) and `apps/mobile` (Expo) — ADR-001.

| Module | What |
| :--- | :--- |
| `article`, `live-events` | API data types (`FeedArticle`, `LiveEventTimeline`, …) |
| `news-api` | `createNewsApi(axiosInstance)` — typed API client; each app supplies its base URL |
| `bookmark-sync`, `device` | Offline-first bookmark backup (ADR-006); storage and randomness are injected |
| `backoff`, `live-events-reducer` | WebSocket reconnect backoff and live-update reducer (ADR-005) |
| `timeline-grouping`, `region` | Day/month grouping of timelines, region preference (ADR-009) |

Rules: no DOM, React or Node-only APIs at module load — anything platform-specific is passed in.
Imported as `@ht/shared/<module>` (tsconfig paths; `experimental.externalDir` in `apps/web/next.config.ts`; Metro `watchFolders` in `apps/mobile`).
