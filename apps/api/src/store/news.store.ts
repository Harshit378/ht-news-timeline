import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { sanitizeStoryQuery } from '../ingestion/gdelt-doc.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ArticleRecord,
  BookmarkRecord,
  EventUpdateRecord,
  LiveEventRecord,
  RssFeedRecord,
  TopicSummaryRecord,
} from './types';

const MAX_MEMORY_ARTICLES = 5000;

/** Newest rows matching any term; scored in memory (Postgres full-text search can replace this). */
const SEARCH_CANDIDATES = 1000;

/**
 * Lowercased search words; same rules as GDELT story queries (≥ 3 chars, no operators).
 * Bare numbers such as years are dropped unless they are the whole query — headlines rarely say "2026".
 */
export function searchTerms(q: string) {
  const words = sanitizeStoryQuery(q).toLowerCase().split(' ').filter(Boolean);
  const meaningful = words.filter((w) => !/^\d+$/.test(w));
  return meaningful.length ? meaningful : words;
}

@Injectable()
export class NewsStore {
  private articles = new Map<string, ArticleRecord>();
  /** Articles fetched for story timelines: resolvable by id, but kept out of feed/trending. */
  private storyArticles = new Map<string, ArticleRecord>();
  private bookmarks = new Map<string, BookmarkRecord>();
  private summaries = new Map<string, TopicSummaryRecord>();
  private feeds = new Map<string, RssFeedRecord>();
  private events = new Map<string, LiveEventRecord>();
  private dbReady = false;

  constructor(private readonly prisma: PrismaService) {}

  async init() {
    this.dbReady = await this.prisma.isReady();
    if (!this.dbReady) {
      this.seedLiveEvents();
      return;
    }
    // Articles and bookmarks are queried on demand; only the small tables are cached in memory.
    const [summaries, feeds, events] = await Promise.all([
      this.prisma.topicSummary.findMany(),
      this.prisma.rssFeed.findMany(),
      this.prisma.liveEvent.findMany({ include: { updates: { orderBy: { timestamp: 'desc' } } } }),
    ]);
    for (const s of summaries) this.summaries.set(s.topicName.toLowerCase(), s);
    for (const f of feeds) this.feeds.set(f.id, f);
    for (const e of events) this.events.set(e.id, e);
    if (this.events.size === 0) {
      this.seedLiveEvents();
      await this.persistSeedEvents();
    }
  }

  async listArticles(category?: string, { skip = 0, take = 200 }: { skip?: number; take?: number } = {}) {
    const filter = category && category !== 'all' ? category : undefined;
    if (this.dbReady) {
      const rows = await this.prisma.article.findMany({
        where: { inFeed: true, ...(filter && { category: filter }) },
        orderBy: { publishedAt: 'desc' },
        skip,
        take,
      });
      return rows.map((a) => this.mapArticle(a));
    }
    const items = [...this.articles.values()]
      .filter((a) => !filter || a.category === filter)
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    return items.slice(skip, skip + take);
  }

  async listCategories() {
    if (this.dbReady) {
      const rows = await this.prisma.article.findMany({
        where: { inFeed: true },
        distinct: ['category'],
        select: { category: true },
      });
      return rows.map((r) => r.category);
    }
    return [...new Set([...this.articles.values()].map((a) => a.category))];
  }

  async getArticle(id: string) {
    if (this.dbReady) {
      const row = await this.prisma.article.findUnique({ where: { id } });
      return row ? this.mapArticle(row) : null;
    }
    return this.articles.get(id) ?? this.storyArticles.get(id) ?? null;
  }

  rememberStoryArticles(records: ArticleRecord[], max = 5000) {
    for (const r of records) {
      this.storyArticles.delete(r.id); // re-insert to refresh LRU position
      this.storyArticles.set(r.id, r);
    }
    while (this.storyArticles.size > max) {
      const oldest = this.storyArticles.keys().next().value;
      if (oldest === undefined) break;
      this.storyArticles.delete(oldest);
    }
  }

  /**
   * Word-based match over headline, excerpt and source. Queries of 3+ words may miss one word, so
   * "MLB World Series 2026" still finds ESPN's "World Series Game 1: Takeaways…". Best matches
   * first, then newest. In postgres mode this also covers story-only (archived) articles.
   */
  async searchArticles(q: string, take = 200) {
    const terms = searchTerms(q);
    if (terms.length === 0) return [];
    let candidates: ArticleRecord[];
    if (this.dbReady) {
      const rows = await this.prisma.article.findMany({
        where: {
          OR: terms.flatMap((term) => [
            { headline: { contains: term, mode: 'insensitive' as const } },
            { excerpt: { contains: term, mode: 'insensitive' as const } },
            { source: { contains: term, mode: 'insensitive' as const } },
          ]),
        },
        orderBy: { publishedAt: 'desc' },
        take: SEARCH_CANDIDATES,
      });
      candidates = rows.map((a) => this.mapArticle(a));
    } else {
      candidates = await this.listArticles(undefined, { take: Number.MAX_SAFE_INTEGER });
    }
    const needed = terms.length >= 3 ? terms.length - 1 : terms.length;
    return candidates
      .map((a) => {
        const text = `${a.headline} ${a.excerpt} ${a.source}`.toLowerCase();
        return { a, score: terms.filter((t) => text.includes(t)).length };
      })
      .filter((m) => m.score >= needed)
      .sort((x, y) => y.score - x.score || y.a.publishedAt.getTime() - x.a.publishedAt.getTime())
      .slice(0, take)
      .map((m) => m.a);
  }

  async trendingTopics() {
    let counts: [string, number][];
    if (this.dbReady) {
      const rows = await this.prisma.article.groupBy({
        by: ['category'],
        where: { inFeed: true },
        _count: { _all: true },
      });
      counts = rows.map((r) => [r.category, r._count._all]);
    } else {
      const map = new Map<string, number>();
      for (const a of this.articles.values()) map.set(a.category, (map.get(a.category) ?? 0) + 1);
      counts = [...map.entries()];
    }
    return counts
      .sort((a, b) => b[1] - a[1])
      .slice(0, 9)
      .map(([topic, count], i) => ({ rank: i + 1, topic, count }));
  }

  async breaking() {
    let critical: ArticleRecord | undefined;
    if (this.dbReady) {
      const row = await this.prisma.article.findFirst({
        where: { inFeed: true, importance: { in: ['critical', 'high'] } },
        orderBy: { publishedAt: 'desc' },
      });
      critical = row ? this.mapArticle(row) : undefined;
    } else {
      critical = (await this.listArticles(undefined, { take: Number.MAX_SAFE_INTEGER })).find(
        (a) => a.importance === 'critical' || a.importance === 'high',
      );
    }
    if (!critical) return null;
    return {
      articleId: critical.id,
      headline: critical.headline,
      publishedAt: critical.publishedAt.toISOString(),
    };
  }

  async upsertArticles(records: ArticleRecord[]) {
    if (!this.dbReady) {
      for (const record of records) this.articles.set(record.id, record);
      this.trimMemoryArticles();
      return;
    }
    await this.persistArticles(records, true);
  }

  /**
   * Inserts new articles and returns them as stored: a record whose URL already exists under
   * another id resolves to the stored row. Feed ingestion promotes story-only rows into the feed.
   */
  private async persistArticles(records: ArticleRecord[], inFeed: boolean): Promise<ArticleRecord[]> {
    if (records.length === 0) return [];
    await this.prisma.article.createMany({
      data: records.map((r) => ({ ...this.mapArticle(r), inFeed })),
      skipDuplicates: true,
    });
    const urls = records.map((r) => r.url).filter((u): u is string => !!u);
    const stored = await this.prisma.article.findMany({
      where: { OR: [{ id: { in: records.map((r) => r.id) } }, { url: { in: urls } }] },
    });
    const byId = new Map(stored.map((a) => [a.id, a]));
    const byUrl = new Map(stored.filter((a) => a.url).map((a) => [a.url as string, a]));
    // Feeds are re-polled with richer text than an earlier one-line copy (e.g. GDELT's title-only
    // excerpt), and createMany skips existing rows: upgrade the excerpt/image when ours is better.
    const upgrades = records.flatMap((r) => {
      const row = byId.get(r.id) ?? (r.url ? byUrl.get(r.url) : undefined);
      if (!row) return [];
      const data: { excerpt?: string; imageUrl?: string } = {};
      if (r.excerpt.length > row.excerpt.length + 20) data.excerpt = r.excerpt;
      if (!row.imageUrl && r.imageUrl) data.imageUrl = r.imageUrl;
      return Object.keys(data).length ? [this.prisma.article.update({ where: { id: row.id }, data })] : [];
    });
    if (upgrades.length) await this.prisma.$transaction(upgrades);
    if (inFeed) {
      const promote = stored.filter((a) => !a.inFeed).map((a) => a.id);
      if (promote.length) {
        await this.prisma.article.updateMany({ where: { id: { in: promote } }, data: { inFeed: true } });
      }
    }
    const out = new Map<string, ArticleRecord>();
    for (const r of records) {
      const row = byId.get(r.id) ?? (r.url ? byUrl.get(r.url) : undefined);
      if (row) out.set(row.id, this.mapArticle(row));
    }
    return [...out.values()];
  }

  /** Stored story for a timeline key (`<sanitized query>|<category>`), oldest article first. */
  async getStory(key: string) {
    if (!this.dbReady) return null;
    const story = await this.prisma.story.findUnique({
      where: { key },
      include: {
        articles: { include: { article: true }, orderBy: { article: { publishedAt: 'asc' } }, take: 1000 },
      },
    });
    if (!story) return null;
    return {
      lastFetchedAt: story.lastFetchedAt,
      items: story.articles.map((sa) => this.mapArticle(sa.article)),
    };
  }

  /** Persists a fetched story timeline and returns its articles as stored (canonical ids). */
  async saveStory(key: string, query: string, category: string | undefined, records: ArticleRecord[]) {
    if (!this.dbReady) {
      this.rememberStoryArticles(records);
      return records;
    }
    const saved = await this.persistArticles(records, false);
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const story = await tx.story.upsert({
        where: { key },
        create: { key, query, category: category || null, lastFetchedAt: now },
        update: { query, lastFetchedAt: now },
      });
      await tx.storyArticle.createMany({
        data: saved.map((a) => ({ storyId: story.id, articleId: a.id })),
        skipDuplicates: true,
      });
      const span = await tx.article.aggregate({
        where: { stories: { some: { storyId: story.id } } },
        _min: { publishedAt: true },
        _max: { publishedAt: true },
      });
      await tx.story.update({
        where: { id: story.id },
        data: { firstSeen: span._min.publishedAt, lastSeen: span._max.publishedAt },
      });
    });
    return saved;
  }

  async stats() {
    if (!this.dbReady) return null;
    const [articles, stories] = await Promise.all([this.prisma.article.count(), this.prisma.story.count()]);
    return { articles, stories };
  }

  async listBookmarks(userId = 'local'): Promise<BookmarkRecord[]> {
    if (this.dbReady) return this.prisma.bookmark.findMany({ where: { userId } });
    return [...this.bookmarks.values()].filter((b) => b.userId === userId);
  }

  async putBookmarks(articleIds: string[], userId = 'local') {
    if (!this.dbReady) {
      const wanted = new Set(articleIds);
      for (const [key, b] of [...this.bookmarks.entries()]) {
        if (b.userId === userId && !wanted.has(b.articleId)) this.bookmarks.delete(key);
      }
      for (const articleId of articleIds) {
        const key = this.bookmarkKey(userId, articleId);
        this.bookmarks.set(key, { id: key, userId, articleId, createdAt: new Date() });
      }
      return { ok: true, articleIds, missing: [] as string[] };
    }
    // Feed and story articles are both stored, so only ids we have never seen are skipped.
    const missing = await this.prisma.$transaction(async (tx) => {
      const known = await tx.article.findMany({ where: { id: { in: articleIds } }, select: { id: true } });
      const knownIds = new Set(known.map((a) => a.id));
      await tx.bookmark.deleteMany({ where: { userId, articleId: { notIn: articleIds } } });
      await tx.bookmark.createMany({
        data: articleIds.filter((id) => knownIds.has(id)).map((articleId) => ({ userId, articleId })),
        skipDuplicates: true,
      });
      return articleIds.filter((id) => !knownIds.has(id));
    });
    return { ok: true, articleIds, missing };
  }

  getSummary(topicName: string) {
    return this.summaries.get(topicName.toLowerCase()) ?? null;
  }

  /** Topic summaries only; story briefs are read by key. */
  listSummaries() {
    return [...this.summaries.values()].filter((s) => s.kind === 'topic');
  }

  async saveSummary(summary: TopicSummaryRecord) {
    this.summaries.set(summary.topicName.toLowerCase(), summary);
    if (!this.dbReady) return summary;
    return this.prisma.topicSummary.upsert({
      where: { topicName: summary.topicName },
      create: summary as Prisma.TopicSummaryCreateInput,
      update: {
        generatedAt: summary.generatedAt,
        summary: summary.summary,
        keyPoints: summary.keyPoints,
        sentiment: summary.sentiment,
        articleCount: summary.articleCount,
        sourceCount: summary.sourceCount,
        relatedTopics: summary.relatedTopics,
        trend: summary.trend,
        confidence: summary.confidence,
        kind: summary.kind,
        inputHash: summary.inputHash,
        model: summary.model,
      },
    });
  }

  listFeeds() {
    return [...this.feeds.values()];
  }

  getFeed(id: string) {
    return this.feeds.get(id) ?? null;
  }

  findFeedByUrl(url: string) {
    return [...this.feeds.values()].find((f) => f.url === url) ?? null;
  }

  async saveFeed(feed: RssFeedRecord) {
    this.feeds.set(feed.id, feed);
    if (!this.dbReady) return feed;
    const { id, url, addedAt, ...mutable } = feed;
    return this.prisma.rssFeed.upsert({
      where: { url },
      create: { id, url, addedAt, ...mutable },
      update: mutable,
    });
  }

  async removeFeed(id: string) {
    this.feeds.delete(id);
    if (this.dbReady) await this.prisma.rssFeed.deleteMany({ where: { id } });
  }

  listEvents() {
    return [...this.events.values()];
  }

  getEvent(id: string) {
    return this.events.get(id) ?? null;
  }

  async addEventUpdate(eventId: string, message: string, importance = 'normal') {
    const event = this.events.get(eventId);
    if (!event) return null;
    const update: EventUpdateRecord = this.dbReady
      ? await this.prisma.eventUpdate.create({ data: { eventId, message, importance, sources: [] } })
      : {
          id: `upd-${Date.now()}`,
          eventId,
          timestamp: new Date(),
          message,
          importance,
          sources: [],
        };
    event.updates = [update, ...(event.updates ?? [])];
    event.lastUpdated = new Date();
    this.events.set(eventId, event);
    return { event, update };
  }

  /** Memory mode has no archive: keep only the newest articles so RSS polling can't grow it forever. */
  private trimMemoryArticles(max = MAX_MEMORY_ARTICLES) {
    if (this.articles.size <= max) return;
    const newestFirst = [...this.articles.values()].sort(
      (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
    );
    for (const a of newestFirst.slice(max)) this.articles.delete(a.id);
  }

  private bookmarkKey(userId: string, articleId: string) {
    return `${userId}:${articleId}`;
  }

  private mapArticle(a: ArticleRecord): ArticleRecord {
    return {
      id: a.id,
      headline: a.headline,
      excerpt: a.excerpt,
      body: a.body,
      source: a.source,
      sourceDomain: a.sourceDomain,
      url: a.url,
      category: a.category,
      publishedAt: a.publishedAt,
      imageUrl: a.imageUrl,
      sentiment: a.sentiment,
      bias: a.bias,
      importance: a.importance,
      storyClusterId: a.storyClusterId,
      tone: a.tone,
    };
  }

  private async persistSeedEvents() {
    for (const e of this.events.values()) {
      await this.prisma.liveEvent.create({
        data: {
          id: e.id,
          name: e.name,
          slug: e.slug,
          description: e.description,
          category: e.category,
          status: e.status,
          startDate: e.startDate,
          endDate: e.endDate,
          updates: {
            create: (e.updates ?? []).map((u) => ({
              id: u.id,
              timestamp: u.timestamp,
              message: u.message,
              importance: u.importance,
              sources: u.sources,
            })),
          },
        },
      });
    }
  }

  private seedLiveEvents() {
    const samples: LiveEventRecord[] = [
      {
        id: 'election-live',
        name: 'Global Elections Desk',
        slug: 'elections',
        description: 'Moment-by-moment coverage of national votes and results.',
        category: 'election',
        status: 'ongoing',
        startDate: new Date(),
        endDate: null,
        lastUpdated: new Date(),
        updates: [
          {
            id: 'upd-1',
            eventId: 'election-live',
            timestamp: new Date(),
            message: 'Polls closing in eastern precincts. Counting underway.',
            importance: 'high',
            sources: ['AP', 'Reuters'],
          },
        ],
      },
      {
        id: 'summit-live',
        name: 'Diplomatic Summit',
        slug: 'summit',
        description: 'Live notes from the multilateral summit.',
        category: 'summit',
        status: 'scheduled',
        startDate: new Date(Date.now() + 86400000),
        endDate: null,
        lastUpdated: new Date(),
        updates: [],
      },
    ];
    for (const e of samples) this.events.set(e.id, e);
  }
}
