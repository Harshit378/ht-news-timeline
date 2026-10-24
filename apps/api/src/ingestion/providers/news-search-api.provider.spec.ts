import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { NewsSearchApiProvider, toArticleRecord } from './news-search-api.provider';
import { NewsSearchService } from '../news-search.service';
import type { UsageTracker } from '../usage-tracker';

/** In-memory stand-in for UsageTracker (no Postgres). */
function usage(start = 0) {
  const amounts = new Map<string, number>();
  return {
    get: vi.fn(async (p: string, period: string) => amounts.get(`${p}:${period}`) ?? start),
    add: vi.fn(async (p: string, period: string, n: number) => {
      const total = (amounts.get(`${p}:${period}`) ?? start) + n;
      amounts.set(`${p}:${period}`, total);
      return total;
    }),
  } as unknown as UsageTracker & { add: ReturnType<typeof vi.fn> };
}

const FIXTURE = {
  meta: { found: 2, returned: 2, limit: 25, page: 1 },
  data: [
    {
      uuid: 'u1',
      title: 'Dodgers win World Series in Game 7',
      description: 'Los Angeles beat Toronto 5-4 in extra innings.',
      url: 'https://www.espn.com/mlb/story/123?utm_source=newsapi',
      image_url: 'https://img.espn.com/1.jpg',
      published_at: '2026-11-02T04:10:00.000000Z',
      source: 'espn.com',
      categories: ['sports'],
    },
    { uuid: 'u2', title: '', url: 'https://example.com/no-title' },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe('toArticleRecord', () => {
  it('normalizes a vendor article with the shared sha1-of-URL id scheme', () => {
    const now = new Date('2026-11-03T00:00:00Z');
    const rec = toArticleRecord(FIXTURE.data[0], 'world', now)!;
    expect(rec).toMatchObject({
      headline: 'Dodgers win World Series in Game 7',
      source: 'espn.com',
      url: 'https://www.espn.com/mlb/story/123',
      category: 'sports',
      publishedAt: new Date('2026-11-02T04:10:00Z'),
      imageUrl: 'https://img.espn.com/1.jpg',
    });
    expect(rec.id).toMatch(/^[0-9a-f]{16}$/);
    expect(toArticleRecord(FIXTURE.data[1])).toBeNull();
  });
});

describe('NewsSearchApiProvider', () => {
  const env = { NEWS_API_KEY: 'k', NEWS_API_DAILY_LIMIT: '2' };

  it('is disabled without a key and never calls the network', async () => {
    const get = vi.spyOn(axios, 'get');
    const p = new NewsSearchApiProvider(usage(), {});
    expect(p.enabled).toBe(false);
    await expect(p.search('world series', {})).resolves.toEqual([]);
    expect(p.status()).toMatchObject({ state: 'disabled', lastError: 'NEWS_API_KEY not set' });
    expect(get).not.toHaveBeenCalled();
  });

  it('searches with the sanitized query and mapped category, counting one request', async () => {
    const get = vi.spyOn(axios, 'get').mockResolvedValue({ data: FIXTURE });
    const u = usage();
    const p = new NewsSearchApiProvider(u, env);
    const items = await p.search('MLB World Series 2026!', { category: 'sports' });
    expect(items).toHaveLength(1);
    const [, config] = get.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(config.params).toMatchObject({ api_token: 'k', search: 'MLB World Series 2026', categories: 'sports', language: 'en' });
    expect(u.add).toHaveBeenCalledTimes(1);
    expect(p.status()).toMatchObject({ state: 'ok', quota: { used: 1, limit: 2 } });
  });

  it('serves repeat queries from the 15-minute cache without spending quota', async () => {
    const get = vi.spyOn(axios, 'get').mockResolvedValue({ data: FIXTURE });
    const u = usage();
    const p = new NewsSearchApiProvider(u, env);
    await p.search('world series', {});
    await p.search('World Series', {});
    expect(get).toHaveBeenCalledTimes(1);
    expect(u.add).toHaveBeenCalledTimes(1);
  });

  it('returns nothing once the daily quota is used, so search is not marked degraded', async () => {
    const get = vi.spyOn(axios, 'get').mockResolvedValue({ data: FIXTURE });
    const p = new NewsSearchApiProvider(usage(2), env); // already at the limit today
    const rss = { id: 'rss', search: vi.fn(async () => []), status: () => ({}) as never };
    const svc = new NewsSearchService([rss, p]);
    await expect(svc.search('world series')).resolves.toEqual({ items: [], degraded: false });
    expect(get).not.toHaveBeenCalled();
  });

  it('reports HTTP failures without leaking the token', async () => {
    const err = Object.assign(new Error('Request failed https://api.thenewsapi.com/v1/news/all?api_token=k'), {
      isAxiosError: true,
      response: { status: 401 },
    });
    vi.spyOn(axios, 'get').mockRejectedValue(err);
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    const p = new NewsSearchApiProvider(usage(), env);
    const failure = await p.search('world series', {}).catch((e: Error) => e);
    expect((failure as Error).message).toBe('news-api: HTTP 401');
    expect(JSON.stringify(p.status())).not.toContain('api_token');
  });

  it('is skipped by NewsSearchService when disabled', async () => {
    const p = new NewsSearchApiProvider(usage(), {});
    const spy = vi.spyOn(p, 'search');
    const rss = { id: 'rss', search: vi.fn(async () => []), status: () => ({}) as never };
    await new NewsSearchService([rss, p]).search('x y z');
    expect(spy).not.toHaveBeenCalled();
  });
});
