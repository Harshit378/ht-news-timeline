import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { NewsStore } from './news.store';
import type { ArticleRecord } from './types';

function rec(id: string, category = 'world', iso = '2026-10-01T00:00:00Z'): ArticleRecord {
  return {
    id,
    headline: `Headline ${id}`,
    excerpt: `Excerpt ${id}`,
    body: null,
    source: 'ex.com',
    sourceDomain: 'ex.com',
    url: `https://ex.com/${id}`,
    category,
    publishedAt: new Date(iso),
    imageUrl: null,
    sentiment: 'neutral',
    bias: 'center',
    importance: 'normal',
    storyClusterId: null,
    tone: 0,
  };
}

async function memoryStore() {
  const store = new NewsStore({ isReady: async () => false } as never);
  await store.init();
  return store;
}

describe('NewsStore (memory mode)', () => {
  it('keeps story articles resolvable by id but out of the feed', async () => {
    const store = await memoryStore();
    await store.upsertArticles([rec('f1', 'tech')]);
    const saved = await store.saveStory('mars|', 'mars', undefined, [rec('s1')]);

    expect(saved.map((a) => a.id)).toEqual(['s1']);
    expect((await store.getArticle('s1'))?.id).toBe('s1');
    expect((await store.listArticles()).map((a) => a.id)).toEqual(['f1']);
    expect(await store.getStory('mars|')).toBeNull(); // memory mode relies on the controller cache
  });

  it('paginates the feed newest first', async () => {
    const store = await memoryStore();
    await store.upsertArticles([
      rec('old', 'world', '2026-01-01T00:00:00Z'),
      rec('new', 'world', '2026-10-01T00:00:00Z'),
      rec('mid', 'world', '2026-05-01T00:00:00Z'),
    ]);
    expect((await store.listArticles('world', { skip: 1, take: 1 })).map((a) => a.id)).toEqual(['mid']);
  });
});

describe('NewsStore.searchArticles (memory mode)', () => {
  it('matches words in any order, ignores years and tolerates one missing word in long queries', async () => {
    const store = await memoryStore();
    await store.upsertArticles([
      { ...rec('espn', 'sports'), headline: "World Series Game 1: Takeaways from Brewers' win over Rays", excerpt: 'Recap' },
      { ...rec('other', 'world'), headline: 'World leaders meet', excerpt: 'Summit talks' },
    ]);
    expect((await store.searchArticles('MLB World Series 2026')).map((a) => a.id)).toEqual(['espn']);
    expect((await store.searchArticles('series world')).map((a) => a.id)).toEqual(['espn']);
    expect(await store.searchArticles('world series mlb nba')).toEqual([]); // two words missing
  });
});

describe('NewsStore (postgres mode) putBookmarks', () => {
  it('stores bookmarks for known articles and reports unknown ids', async () => {
    const tx = {
      article: { findMany: vi.fn(async () => [{ id: 'story-article' }]) },
      bookmark: { deleteMany: vi.fn(), createMany: vi.fn() },
    };
    const prisma = {
      isReady: async () => true,
      topicSummary: { findMany: async () => [] },
      rssFeed: { findMany: async () => [] },
      liveEvent: { findMany: async () => [{ id: 'e1', updates: [] }] },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    };
    const store = new NewsStore(prisma as never);
    await store.init();

    const res = await store.putBookmarks(['story-article', 'never-seen']);
    expect(res.missing).toEqual(['never-seen']);
    expect(tx.bookmark.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'local', articleId: 'story-article' }],
      skipDuplicates: true,
    });
  });
});
