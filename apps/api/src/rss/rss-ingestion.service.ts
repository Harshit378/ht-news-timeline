import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { NewsStore } from '../store/news.store';
import { ArticleRecord, RssFeedRecord } from '../store/types';
import { CURATED_FEEDS } from './curated-feeds';
import { ParsedFeedItem, RssService } from './rss.service';

const CONCURRENCY = 4;
/** Feeds failing this many polls in a row are retried at most hourly. */
const FAILURE_THRESHOLD = 5;
const FAILING_RETRY_MS = 60 * 60 * 1000;

const TRACKING_PARAM = /^(utm_|at_|fbclid$|gclid$|cmp$|ns_)/i;

/** Drops fragments and tracking params so the same story dedupes across feeds and GDELT. */
export function normalizeArticleUrl(raw: string) {
  try {
    const u = new URL(raw);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return raw;
  }
}

function parsePublished(raw: string, now: Date) {
  const t = Date.parse(raw);
  // Missing, unparseable or future-dated items are treated as just published.
  if (!Number.isFinite(t) || t > now.getTime()) return now;
  return new Date(t);
}

export function itemToArticle(item: ParsedFeedItem, feed: RssFeedRecord, now = new Date()): ArticleRecord {
  const url = normalizeArticleUrl(item.link);
  const publishedAt = parsePublished(item.pubDate, now);
  let domain: string | null = null;
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // keep null
  }
  return {
    // Same id scheme as GDELT (sha1 of the URL) so a story seen by both sources is one row.
    id: createHash('sha1').update(url).digest('hex').slice(0, 16),
    headline: item.title,
    excerpt: item.description || item.title,
    body: null,
    source: feed.source || feed.title,
    sourceDomain: domain,
    url,
    category: feed.category,
    publishedAt,
    imageUrl: item.imageUrl,
    sentiment: null,
    bias: null,
    importance: 'normal',
    storyClusterId: `${feed.category}-${publishedAt.toISOString().slice(0, 10)}`,
    tone: null,
  };
}

export interface RssPollResult {
  polled: number;
  notModified: number;
  failed: number;
  articles: number;
}

@Injectable()
export class RssIngestionService {
  private readonly logger = new Logger(RssIngestionService.name);

  constructor(
    private readonly rss: RssService,
    private readonly store: NewsStore,
  ) {}

  /** Adds missing curated feeds and refreshes their metadata; never overrides a user's on/off toggle. */
  async seedCurated() {
    for (const c of CURATED_FEEDS) {
      const existing = this.store.findFeedByUrl(c.url);
      await this.store.saveFeed(
        existing
          ? { ...existing, title: c.title, source: c.source, category: c.category, origin: 'curated' }
          : {
              id: randomUUID(),
              title: c.title,
              url: c.url,
              description: null,
              category: c.category,
              isActive: true,
              origin: 'curated',
              source: c.source,
              etag: null,
              lastModified: null,
              lastChecked: null,
              lastItemAt: null,
              lastError: null,
              failureCount: 0,
              itemCount: 0,
              addedAt: new Date(),
            },
      );
    }
  }

  async pollAll(onBatch: (batch: ArticleRecord[]) => Promise<void>): Promise<RssPollResult> {
    const now = Date.now();
    const due = this.store
      .listFeeds()
      .filter(
        (f) =>
          f.isActive &&
          !(f.failureCount >= FAILURE_THRESHOLD && f.lastChecked && now - f.lastChecked.getTime() < FAILING_RETRY_MS),
      );
    const result: RssPollResult = { polled: due.length, notModified: 0, failed: 0, articles: 0 };
    const queue = [...due];
    const worker = async () => {
      for (let feed = queue.shift(); feed; feed = queue.shift()) {
        const outcome = await this.pollFeed(feed, onBatch);
        if (outcome === 'failed') result.failed += 1;
        else if (outcome === 'not-modified') result.notModified += 1;
        else result.articles += outcome;
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    return result;
  }

  private async pollFeed(
    feed: RssFeedRecord,
    onBatch: (batch: ArticleRecord[]) => Promise<void>,
  ): Promise<number | 'not-modified' | 'failed'> {
    const checkedAt = new Date();
    try {
      const res = await this.rss.fetchFeed(feed.url, feed);
      if (res.notModified) {
        await this.store.saveFeed({ ...feed, lastChecked: checkedAt, lastError: null, failureCount: 0 });
        return 'not-modified';
      }
      const articles = res.items.map((item) => itemToArticle(item, feed, checkedAt));
      if (articles.length) await onBatch(articles);
      const newest = articles.reduce<Date | null>(
        (max, a) => (!max || a.publishedAt > max ? a.publishedAt : max),
        feed.lastItemAt,
      );
      await this.store.saveFeed({
        ...feed,
        etag: res.etag,
        lastModified: res.lastModified,
        lastChecked: checkedAt,
        lastItemAt: newest,
        lastError: null,
        failureCount: 0,
        itemCount: articles.length,
      });
      return articles.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`RSS ${feed.url} failed: ${message}`);
      await this.store.saveFeed({
        ...feed,
        lastChecked: checkedAt,
        lastError: message.slice(0, 300),
        failureCount: feed.failureCount + 1,
      });
      return 'failed';
    }
  }
}
