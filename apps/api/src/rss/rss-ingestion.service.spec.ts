import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { RssIngestionService, itemToArticle, normalizeArticleUrl } from './rss-ingestion.service';
import type { RssFeedRecord } from '../store/types';

function feed(overrides: Partial<RssFeedRecord> = {}): RssFeedRecord {
  return {
    id: 'f1', title: 'ESPN — MLB', url: 'https://ex.test/feed', description: null, category: 'sports',
    isActive: true, origin: 'curated', source: 'ESPN', etag: null, lastModified: null, lastChecked: null,
    lastItemAt: null, lastError: null, failureCount: 0, itemCount: 0, addedAt: new Date(), ...overrides,
  };
}

const item = (link: string, pubDate: string) => ({
  id: link, title: 'Brewers win Game 1', description: '', link, pubDate, imageUrl: null,
});

describe('itemToArticle', () => {
  const now = new Date('2026-10-24T18:00:00Z');

  it('strips tracking params so ids match across feeds', () => {
    const a = itemToArticle(item('https://www.bbc.co.uk/news/x?at_medium=RSS&at_campaign=rss#0', ''), feed(), now);
    const b = itemToArticle(item('https://www.bbc.co.uk/news/x', ''), feed(), now);
    expect(a.url).toBe('https://www.bbc.co.uk/news/x');
    expect(a.id).toBe(b.id);
    expect(a.sourceDomain).toBe('bbc.co.uk');
  });

  it('maps feed metadata and clamps missing or future dates to now', () => {
    const a = itemToArticle(item('https://ex.test/a', 'Sat, 24 Oct 2026 10:23:25 EST'), feed(), now);
    expect(a).toMatchObject({ source: 'ESPN', category: 'sports', excerpt: 'Brewers win Game 1', body: null });
    expect(a.publishedAt.toISOString()).toBe('2026-10-24T15:23:25.000Z');
    expect(itemToArticle(item('https://ex.test/b', '2027-01-01'), feed(), now).publishedAt).toEqual(now);
    expect(itemToArticle(item('https://ex.test/c', 'not a date'), feed({ source: null }), now)).toMatchObject({
      publishedAt: now,
      source: 'ESPN — MLB',
    });
  });

  it('keeps non-tracking query params', () => {
    expect(normalizeArticleUrl('https://ex.test/a?id=5&utm_source=x')).toBe('https://ex.test/a?id=5');
  });
});

describe('RssIngestionService.pollAll', () => {
  it('stores items, records failures and skips feeds that keep failing', async () => {
    const feeds = [
      feed({ id: 'ok', url: 'https://ok.test/feed' }),
      feed({ id: 'bad', url: 'https://bad.test/feed' }),
      feed({ id: 'stale', url: 'https://stale.test/feed', failureCount: 5, lastChecked: new Date() }),
      feed({ id: 'off', url: 'https://off.test/feed', isActive: false }),
    ];
    const saved: RssFeedRecord[] = [];
    const store = { listFeeds: () => feeds, saveFeed: vi.fn(async (f: RssFeedRecord) => saved.push(f)) };
    const rss = {
      fetchFeed: vi.fn(async (url: string) => {
        if (url.includes('bad')) throw new Error('boom');
        return { notModified: false, title: 't', description: '', etag: '"e"', lastModified: null, parseTime: 0,
          items: [item('https://ok.test/a', '2026-10-01T00:00:00Z')] };
      }),
    };
    const onBatch = vi.fn(async () => undefined);
    const svc = new RssIngestionService(rss as never, store as never);

    const res = await svc.pollAll(onBatch);
    expect(res).toEqual({ polled: 2, notModified: 0, failed: 1, articles: 1 });
    expect(onBatch).toHaveBeenCalledTimes(1);
    expect(saved.find((f) => f.id === 'ok')).toMatchObject({ etag: '"e"', itemCount: 1, failureCount: 0 });
    expect(saved.find((f) => f.id === 'bad')).toMatchObject({ failureCount: 1, lastError: 'boom' });
  });
});
