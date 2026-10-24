import { describe, expect, it, vi } from 'vitest';
import { interleaveByRegion, parseRegion, regionFromGdeltCountry } from './region';
import { FeedController } from '../rest/feed.controller';
import { itemToArticle } from '../rss/rss-ingestion.service';
import { toArticleRecord } from '../ingestion/providers/news-search-api.provider';
import { CURATED_FEEDS } from '../rss/curated-feeds';

describe('region helpers', () => {
  it('accepts only two-letter codes', () => {
    expect(parseRegion('in')).toBe('IN');
    expect(parseRegion(' GB ')).toBe('GB');
    expect(parseRegion('GLOBAL')).toBeNull();
    expect(parseRegion("IN' OR 1=1")).toBeNull();
    expect(parseRegion(undefined)).toBeNull();
  });

  it('maps GDELT source countries', () => {
    expect(regionFromGdeltCountry('India')).toBe('IN');
    expect(regionFromGdeltCountry('United Kingdom')).toBe('GB');
    expect(regionFromGdeltCountry('Atlantis')).toBeNull();
  });

  it('gives the region ~40% of each page, interleaved, each side newest first', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: `a${i}`,
      publishedAt: new Date(Date.UTC(2026, 9, 24, 0, 50 - i)),
      region: i % 2 === 0 ? 'US' : i < 40 ? 'GB' : 'IN', // IN is both rare and old
    }));
    const out = interleaveByRegion(items, 'IN');
    expect(out.slice(0, 10).filter((a) => a.region === 'IN')).toHaveLength(4);
    expect(out).toHaveLength(50); // nothing dropped
    const local = out.filter((a) => a.region === 'IN').map((a) => a.id);
    expect(local).toEqual(['a41', 'a43', 'a45', 'a47', 'a49']);
  });
});

describe('region tagging at ingest', () => {
  it('tags every curated feed', () => {
    expect(CURATED_FEEDS.every((f) => f.region === 'GLOBAL' || /^[A-Z]{2}$/.test(f.region))).toBe(true);
    expect(CURATED_FEEDS.filter((f) => f.source === 'Times of India').every((f) => f.region === 'IN')).toBe(true);
  });

  it('copies the feed region to RSS articles and reads the News API locale', () => {
    const feed = { category: 'world', source: 'Times of India', title: 'TOI', region: 'IN' } as never;
    const a = itemToArticle({ title: 'T', link: 'https://toi.in/a', description: 'd', pubDate: '', imageUrl: null } as never, feed);
    expect(a.region).toBe('IN');
    expect(toArticleRecord({ title: 'T', url: 'https://x.com/a', locale: 'gb' })?.region).toBe('GB');
  });
});

describe('FeedController region', () => {
  it('passes a valid region to the store and ignores junk', async () => {
    const store = { listArticles: vi.fn(async () => []) };
    const ctrl = new FeedController(store as never);
    await ctrl.getFeed(undefined, '1', 'in');
    expect(store.listArticles).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ region: 'IN' }));
    await ctrl.getFeed(undefined, '1', 'india');
    expect(store.listArticles).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ region: null }));
  });
});
