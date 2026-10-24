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

function makeBriefs() {
  return { ensure: vi.fn(async () => undefined), get: vi.fn(() => ({ status: 'pending' })) };
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
  it('merges provider + archive results oldest-first and caches per query', async () => {
    const providers = {
      search: vi.fn(async () => ({
        items: [
          rec('g2', '2026-10-01T00:00:00Z', 'Second development'),
          rec('g1', '2026-08-01T00:00:00Z', 'Story begins'),
        ],
        degraded: false,
      })),
    };
    const store = makeStore([rec('s1', '2026-10-20T00:00:00Z', 'Latest update')]);
    const ctrl = new TimelineController(store as never, providers as never, makeBriefs() as never);

    const res = await ctrl.timeline('Election  results', undefined);
    expect(res.items.map((i) => i.id)).toEqual(['g1', 'g2', 's1']);
    expect(res.firstSeen).toBe('2026-08-01T00:00:00.000Z');
    expect(res.lastSeen).toBe('2026-10-20T00:00:00.000Z');
    expect(res.degraded).toBe(false);
    expect(store.saveStory).toHaveBeenCalledTimes(1);
    expect(store.saveStory.mock.calls[0][0]).toBe('election results|');

    await ctrl.timeline('election results', undefined);
    expect(providers.search).toHaveBeenCalledTimes(1); // second call served from cache
  });

  it('falls back to archive matches when providers fail', async () => {
    const providers = { search: vi.fn(async () => Promise.reject(new Error('429'))) };
    const store = makeStore([rec('s1', '2026-10-20T00:00:00Z', 'Local match')]);
    const ctrl = new TimelineController(store as never, providers as never, makeBriefs() as never);
    const res = await ctrl.timeline('anything', undefined);
    expect(res.items.map((i) => i.id)).toEqual(['s1']);
    expect(res.degraded).toBe(true);
  });

  it('collapses concurrent requests for the same story', async () => {
    let release!: () => void;
    const providers = {
      search: vi.fn(
        () =>
          new Promise<{ items: ArticleRecord[]; degraded: boolean }>(
            (r) => (release = () => r({ items: [rec('g1', '2026-08-01T00:00:00Z', 'x')], degraded: false })),
          ),
      ),
    };
    const ctrl = new TimelineController(makeStore() as never, providers as never, makeBriefs() as never);
    const p1 = ctrl.timeline('mars mission', undefined);
    const p2 = ctrl.timeline('Mars mission', undefined);
    await new Promise((r) => setTimeout(r, 0)); // let both stored-story lookups settle
    release();
    await Promise.all([p1, p2]);
    expect(providers.search).toHaveBeenCalledTimes(1);
  });

  it('responds degraded at the deadline but keeps fetching to warm the cache', async () => {
    let release!: () => void;
    const providers = {
      search: vi.fn(
        () =>
          new Promise<{ items: ArticleRecord[]; degraded: boolean }>(
            (r) => (release = () => r({ items: [rec('g1', '2026-08-01T00:00:00Z', 'Late result')], degraded: false })),
          ),
      ),
    };
    const ctrl = new TimelineController(makeStore() as never, providers as never, makeBriefs() as never);
    ctrl.deadlineMs = 20;
    const first = await ctrl.timeline('slow story', undefined);
    expect(first.degraded).toBe(true);
    expect(first.items).toEqual([]);
    release();
    await new Promise((r) => setTimeout(r, 0));
    const second = await ctrl.timeline('slow story', undefined);
    expect(second.degraded).toBe(false);
    expect(second.items.map((i) => i.id)).toEqual(['g1']);
    expect(providers.search).toHaveBeenCalledTimes(1);
  });

  it('serves a fresh stored story without calling providers', async () => {
    const providers = { search: vi.fn() };
    const store = makeStore([], { lastFetchedAt: new Date(), items: [rec('p1', '2026-07-01T00:00:00Z', 'Persisted')] });
    const ctrl = new TimelineController(store as never, providers as never, makeBriefs() as never);
    const res = await ctrl.timeline('persisted story', undefined);
    expect(res.items.map((i) => i.id)).toEqual(['p1']);
    expect(res.degraded).toBe(false);
    expect(providers.search).not.toHaveBeenCalled();
  });

  it('falls back to a stale stored story when providers fail', async () => {
    const providers = { search: vi.fn(async () => Promise.reject(new Error('429'))) };
    const stale = new Date(Date.now() - 60 * 60 * 1000);
    const store = makeStore([], { lastFetchedAt: stale, items: [rec('p1', '2026-07-01T00:00:00Z', 'Persisted')] });
    const ctrl = new TimelineController(store as never, providers as never, makeBriefs() as never);
    const res = await ctrl.timeline('persisted story', undefined);
    expect(providers.search).toHaveBeenCalledTimes(1);
    expect(res.items.map((i) => i.id)).toEqual(['p1']);
    expect(res.degraded).toBe(true);
  });

  it('still answers when persisting the story fails', async () => {
    const providers = { search: vi.fn(async () => ({ items: [rec('g1', '2026-08-01T00:00:00Z', 'x')], degraded: false })) };
    const store = makeStore();
    store.saveStory.mockRejectedValueOnce(new Error('db down'));
    const ctrl = new TimelineController(store as never, providers as never, makeBriefs() as never);
    const res = await ctrl.timeline('db outage', undefined);
    expect(res.items.map((i) => i.id)).toEqual(['g1']);
    expect(res.degraded).toBe(false);
    expect(store.rememberStoryArticles).toHaveBeenCalledTimes(1);
  });

  it('starts the story brief in the background with the final items', async () => {
    const providers = { search: vi.fn(async () => ({ items: [rec('g1', '2026-08-01T00:00:00Z', 'Begins')], degraded: false })) };
    const store = makeStore([rec('s1', '2026-10-20T00:00:00Z', 'Latest')]);
    const briefs = makeBriefs();
    let release!: () => void;
    briefs.ensure.mockImplementation(() => new Promise<undefined>((r) => (release = () => r(undefined))));
    const ctrl = new TimelineController(store as never, providers as never, briefs as never);
    const res = await ctrl.timeline('Brewers Rays', undefined); // resolves while the brief is still running
    expect(res.items.map((i) => i.id)).toEqual(['g1', 's1']);
    expect(briefs.ensure).toHaveBeenCalledWith('brewers rays|', 'Brewers Rays', expect.any(Array));
    release();
  });

  it('still answers when starting the brief throws', async () => {
    const providers = { search: vi.fn(async () => ({ items: [rec('g1', '2026-08-01T00:00:00Z', 'x')], degraded: false })) };
    const briefs = makeBriefs();
    briefs.ensure.mockImplementation(() => {
      throw new Error('boom');
    });
    const ctrl = new TimelineController(makeStore() as never, providers as never, briefs as never);
    expect((await ctrl.timeline('anything', undefined)).items).toHaveLength(1);
  });

  it('serves the brief by story key', () => {
    const briefs = makeBriefs();
    const ctrl = new TimelineController(makeStore() as never, { search: vi.fn() } as never, briefs as never);
    ctrl.brief('  MLB World Series 2026 ', 'sports');
    expect(briefs.get).toHaveBeenCalledWith('mlb world series 2026|sports');
    expect(() => ctrl.brief(' ', undefined)).toThrow('q is required');
  });

  it('rejects an empty query', async () => {
    const ctrl = new TimelineController(makeStore() as never, { search: vi.fn() } as never, makeBriefs() as never);
    await expect(ctrl.timeline('  ', undefined)).rejects.toThrow('q is required');
  });
});
