import { BadRequestException, Controller, Get, Logger, Query } from '@nestjs/common';
import { sanitizeStoryQuery } from '../ingestion/gdelt-doc.service';
import { NewsSearchService } from '../ingestion/news-search.service';
import { StoryBackfillService } from '../ingestion/story-backfill.service';
import { StoryBriefService } from '../summaries/story-brief.service';
import { NewsStore } from '../store/news.store';
import { ArticleRecord } from '../store/types';
import { serializeArticle } from './serialize';

const CACHE_TTL_MS = 15 * 60 * 1000;
/**
 * Respond within this window even if providers are still working (GDELT's rate-limit queue).
 * The fetch keeps running and fills the cache, so a retry shortly after is instant; the
 * stored archive answers in the meantime.
 */
export const STORY_DEADLINE_MS = 15_000;
const MAX_CACHE_ENTRIES = 200;

interface CachedTimeline {
  at: number;
  items: ArticleRecord[];
}

function normalizeHeadline(h: string) {
  return h
    .toLowerCase()
    .replace(/\s+[-|–—]\s+[^-|–—]+$/, '') // trailing " - Publisher"
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Cache / Story / brief key for a timeline query. */
export function storyKey(q: string, category?: string) {
  return `${sanitizeStoryQuery(q.trim()).toLowerCase()}|${category ?? ''}`;
}

/** Drops syndicated copies: same URL, or same headline (keeping the earliest report). */
export function dedupeChronological(records: ArticleRecord[]): ArticleRecord[] {
  const sorted = [...records].sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
  const seenUrls = new Set<string>();
  const seenHeadlines = new Set<string>();
  const out: ArticleRecord[] = [];
  for (const r of sorted) {
    const url = r.url?.split('#')[0].replace(/\/$/, '');
    const headline = normalizeHeadline(r.headline);
    if ((url && seenUrls.has(url)) || (headline && seenHeadlines.has(headline))) continue;
    if (url) seenUrls.add(url);
    if (headline) seenHeadlines.add(headline);
    out.push(r);
  }
  return out;
}

/**
 * GET /api/timeline?q=&category= — a story from its first report to now, oldest first.
 * Provider results (GDELT ≤ 1 week) are cached per query for 15 min and persisted as a Story in
 * postgres; matches from the stored archive (curated RSS, earlier stories) are merged in.
 */
@Controller('timeline')
export class TimelineController {
  private readonly logger = new Logger(TimelineController.name);
  private readonly cache = new Map<string, CachedTimeline>();
  private readonly inFlight = new Map<string, Promise<{ items: ArticleRecord[]; degraded: boolean }>>();
  /** Overridable in tests. */
  deadlineMs = STORY_DEADLINE_MS;

  constructor(
    private readonly store: NewsStore,
    private readonly search: NewsSearchService,
    private readonly briefs: StoryBriefService,
    private readonly backfill: StoryBackfillService,
  ) {}

  /** GET /api/timeline/brief?q=&category= — the AI "What happened" brief, once it has been written. */
  @Get('brief')
  brief(@Query('q') q?: string, @Query('category') category?: string) {
    const query = (q ?? '').trim();
    if (!query) throw new BadRequestException('q is required');
    return this.briefs.get(storyKey(query, category));
  }

  @Get()
  async timeline(@Query('q') q?: string, @Query('category') category?: string) {
    const query = (q ?? '').trim();
    if (!query) throw new BadRequestException('q is required');

    const key = storyKey(query, category);
    const { items: remote, degraded } = await this.fetchCached(key, query, category);
    const items = dedupeChronological([...remote, ...(await this.store.searchArticles(query))]);
    // Background only: the brief is fetched separately and never delays or breaks the timeline.
    try {
      void this.briefs.ensure(key, query, items);
    } catch (err) {
      this.logger.warn(`brief "${query}" not started: ${err instanceof Error ? err.message : err}`);
    }

    // Deep history from BigQuery, also in the background; the client polls while it is pending.
    let backfill: string = 'unavailable';
    try {
      const earliestReport = items.find((a) => a.kind !== 'milestone')?.publishedAt;
      backfill = (await this.backfill.ensure(key, query, category, earliestReport, () => this.cache.delete(key))).state;
    } catch (err) {
      this.logger.warn(`backfill "${query}" not started: ${err instanceof Error ? err.message : err}`);
    }

    return {
      query,
      /** True when a provider couldn't be reached; items are then partial (stale cache / archive). */
      degraded,
      /** BigQuery history: pending (poll again), done, or unavailable (not configured / failed). */
      backfill,
      firstSeen: items[0]?.publishedAt.toISOString() ?? null,
      lastSeen: items[items.length - 1]?.publishedAt.toISOString() ?? null,
      items: items.map(serializeArticle),
    };
  }

  private async fetchCached(key: string, query: string, category?: string) {
    let hit = this.cache.get(key);
    if (!hit) {
      const stored = await this.store.getStory(key);
      if (stored) hit = { at: stored.lastFetchedAt.getTime(), items: stored.items };
    }
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      this.logger.log(`timeline cache hit "${query}" (${hit.items.length})`);
      return { items: hit.items, degraded: false };
    }
    // Collapse concurrent requests for the same story into one provider round-trip.
    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = this.search
        .search(query, category || undefined)
        .then(async ({ items: records, degraded }) => {
          let items = records;
          try {
            items = await this.store.saveStory(key, query, category, records);
          } catch (err) {
            this.logger.warn(`timeline "${query}" not persisted: ${err instanceof Error ? err.message : err}`);
            this.store.rememberStoryArticles(records);
          }
          this.remember(key, items);
          this.logger.log(`timeline providers "${query}" → ${records.length} articles`);
          return { items, degraded };
        })
        .catch((err) => {
          this.logger.warn(`timeline "${query}" providers failed: ${err instanceof Error ? err.message : err}`);
          // Stale cache or store-only results beat an error; flag it so the client can say so.
          return { items: hit?.items ?? [], degraded: true };
        })
        .finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, pending);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<{ items: ArticleRecord[]; degraded: boolean }>((resolve) => {
      timer = setTimeout(() => {
        this.logger.warn(`timeline "${query}" hit ${this.deadlineMs}ms deadline; responding with partial results`);
        resolve({ items: hit?.items ?? [], degraded: true });
      }, this.deadlineMs);
    });
    try {
      return await Promise.race([pending, deadline]);
    } finally {
      clearTimeout(timer);
    }
  }

  private remember(key: string, items: ArticleRecord[]) {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { at: Date.now(), items });
  }
}
