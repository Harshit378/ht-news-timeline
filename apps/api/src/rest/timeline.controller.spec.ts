import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { TimelineController, dedupeChronological } from './timeline.controller';
import { sanitizeStoryQuery } from '../ingestion/gdelt-doc.service';
import type { ArticleRecord } from '../store/types';

function rec(id: string, iso: string, headline: string, url: string | null = `https://ex.com/${id}`): ArticleRecord {
  return {
    id,
    headline,
    excerpt: headline,
    body: headline,
    source: 'ex.com',
    sourceDomain: 'ex.com',
    url,
    category: 'world',
    publishedAt: new Date(iso),
    imageUrl: null,
    sentiment: 'neutral',
    bias: 'center',
    importance: 'normal',
    storyClusterId: null,
    tone: 0,
  };
}

function makeStore(local: ArticleRecord[] = [], stored: { lastFetchedAt: Date; items: ArticleRecord[] } | null = null) {
  return {
    searchArticles: vi.fn(async () => local),
    getStory: vi.fn(async () => stored),
    saveStory: vi.fn(async (_k: string, _q: string, _c: string | undefined, records: ArticleRecord[]) => records),
    rememberStoryArticles: vi.fn(),
  };
}

describe('dedupeChronological', () => {
  it('sorts ascending and drops syndicated copies (same url or headline), keeping the earliest', () => {
    const out = dedupeChronological([
      rec('c', '2026-09-03T00:00:00Z', 'Talks collapse - Reuters'),
      rec('a', '2026-08-01T00:00:00Z', 'Summit announced'),
      rec('b', '2026-08-02T00:00:00Z', 'Summit announced', 'https://other.com/x'),
      rec('d', '2026-09-04T00:00:00Z', 'Talks collapse - AP News', 'https://ap.com/y'),
      rec('e', '2026-09-05T00:00:00Z', 'Different story', 'https://ex.com/a/'),
    ]);
    expect(out.map((r) => r.id)).toEqual(['a', 'c']);
  });
});

describe('sanitizeStoryQuery', () => {
  it('removes GDELT operators and too-short words', () => {
    expect(sanitizeStoryQuery('"Gaza" -ceasefire OR (UN) vote!')).toBe('Gaza ceasefire vote');
  });
});

describe('TimelineController', () => {
  it('merges GDELT + store results oldest-first and caches per query', async () => {
    const gdelt = {
      searchStory: vi.fn(async () => [
        rec('g2', '2026-10-01T00:00:00Z', 'Second development'),
        rec('g1', '2026-08-01T00:00:00Z', 'Story begins'),
      ]),
    };
    const store = makeStore([rec('s1', '2026-10-20T00:00:00Z', 'Latest update')]);
    const ctrl = new TimelineController(store as never, gdelt as never);

    const res = await ctrl.timeline('Election  results', undefined);
    expect(res.items.map((i) => i.id)).toEqual(['g1', 'g2', 's1']);
    expect(res.firstSeen).toBe('2026-08-01T00:00:00.000Z');
    expect(res.lastSeen).toBe('2026-10-20T00:00:00.000Z');
    expect(res.degraded).toBe(false);
    expect(store.saveStory).toHaveBeenCalledTimes(1);
    expect(store.saveStory.mock.calls[0][0]).toBe('election results|');

    await ctrl.timeline('election results', undefined);
    expect(gdelt.searchStory).toHaveBeenCalledTimes(1); // second call served from cache
  });

  it('falls back to store matches when GDELT fails', async () => {
    const gdelt = { searchStory: vi.fn(async () => Promise.reject(new Error('429'))) };
    const store = makeStore([rec('s1', '2026-10-20T00:00:00Z', 'Local match')]);
    const ctrl = new TimelineController(store as never, gdelt as never);
    const res = await ctrl.timeline('anything', undefined);
    expect(res.items.map((i) => i.id)).toEqual(['s1']);
    expect(res.degraded).toBe(true);
  });

  it('collapses concurrent requests for the same story', async () => {
    let release!: () => void;
    const gdelt = {
      searchStory: vi.fn(
        () => new Promise<ArticleRecord[]>((r) => (release = () => r([rec('g1', '2026-08-01T00:00:00Z', 'x')]))),
      ),
    };
    const ctrl = new TimelineController(makeStore() as never, gdelt as never);
    const p1 = ctrl.timeline('mars mission', undefined);
    const p2 = ctrl.timeline('Mars mission', undefined);
    await new Promise((r) => setTimeout(r, 0)); // let both stored-story lookups settle
    release();
    await Promise.all([p1, p2]);
    expect(gdelt.searchStory).toHaveBeenCalledTimes(1);
  });

  it('responds degraded at the deadline but keeps fetching to warm the cache', async () => {
    let release!: () => void;
    const gdelt = {
      searchStory: vi.fn(
        () => new Promise<ArticleRecord[]>((r) => (release = () => r([rec('g1', '2026-08-01T00:00:00Z', 'Late result')]))),
      ),
    };
    const ctrl = new TimelineController(makeStore() as never, gdelt as never);
    ctrl.deadlineMs = 20;
    const first = await ctrl.timeline('slow story', undefined);
    expect(first.degraded).toBe(true);
    expect(first.items).toEqual([]);
    release();
    await new Promise((r) => setTimeout(r, 0));
    const second = await ctrl.timeline('slow story', undefined);
    expect(second.degraded).toBe(false);
    expect(second.items.map((i) => i.id)).toEqual(['g1']);
    expect(gdelt.searchStory).toHaveBeenCalledTimes(1);
  });

  it('serves a fresh stored story without calling GDELT', async () => {
    const gdelt = { searchStory: vi.fn() };
    const store = makeStore([], { lastFetchedAt: new Date(), items: [rec('p1', '2026-07-01T00:00:00Z', 'Persisted')] });
    const ctrl = new TimelineController(store as never, gdelt as never);
    const res = await ctrl.timeline('persisted story', undefined);
    expect(res.items.map((i) => i.id)).toEqual(['p1']);
    expect(res.degraded).toBe(false);
    expect(gdelt.searchStory).not.toHaveBeenCalled();
  });

  it('falls back to a stale stored story when GDELT fails', async () => {
    const gdelt = { searchStory: vi.fn(async () => Promise.reject(new Error('429'))) };
    const stale = new Date(Date.now() - 60 * 60 * 1000);
    const store = makeStore([], { lastFetchedAt: stale, items: [rec('p1', '2026-07-01T00:00:00Z', 'Persisted')] });
    const ctrl = new TimelineController(store as never, gdelt as never);
    const res = await ctrl.timeline('persisted story', undefined);
    expect(gdelt.searchStory).toHaveBeenCalledTimes(1);
    expect(res.items.map((i) => i.id)).toEqual(['p1']);
    expect(res.degraded).toBe(true);
  });

  it('still answers when persisting the story fails', async () => {
    const gdelt = { searchStory: vi.fn(async () => [rec('g1', '2026-08-01T00:00:00Z', 'x')]) };
    const store = makeStore();
    store.saveStory.mockRejectedValueOnce(new Error('db down'));
    const ctrl = new TimelineController(store as never, gdelt as never);
    const res = await ctrl.timeline('db outage', undefined);
    expect(res.items.map((i) => i.id)).toEqual(['g1']);
    expect(res.degraded).toBe(false);
    expect(store.rememberStoryArticles).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty query', async () => {
    const ctrl = new TimelineController(makeStore() as never, { searchStory: vi.fn() } as never);
    await expect(ctrl.timeline('  ', undefined)).rejects.toThrow('q is required');
  });
});
