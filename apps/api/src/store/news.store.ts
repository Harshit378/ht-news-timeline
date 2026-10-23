import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ArticleRecord,
  BookmarkRecord,
  LiveEventRecord,
  RssFeedRecord,
  TopicSummaryRecord,
} from './types';

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
    const [articles, bookmarks, summaries, feeds, events] = await Promise.all([
      this.prisma.article.findMany(),
      this.prisma.bookmark.findMany(),
      this.prisma.topicSummary.findMany(),
      this.prisma.rssFeed.findMany(),
      this.prisma.liveEvent.findMany({ include: { updates: true } }),
    ]);
    for (const a of articles) this.articles.set(a.id, this.mapArticle(a));
    for (const b of bookmarks) this.bookmarks.set(this.bookmarkKey(b.userId, b.articleId), b);
    for (const s of summaries) this.summaries.set(s.topicName.toLowerCase(), s);
    for (const f of feeds) this.feeds.set(f.id, f);
    for (const e of events) this.events.set(e.id, e);
    if (this.events.size === 0) this.seedLiveEvents();
  }

  listArticles(category?: string) {
    const items = [...this.articles.values()].sort(
      (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
    );
    if (!category || category === 'all') return items;
    return items.filter((a) => a.category === category);
  }

  getArticle(id: string) {
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

  searchArticles(q: string) {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return this.listArticles().filter((a) =>
      `${a.headline} ${a.excerpt} ${a.source}`.toLowerCase().includes(needle),
    );
  }

  trendingTopics() {
    const counts = new Map<string, number>();
    for (const a of this.articles.values()) {
      counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 9)
      .map(([topic, count], i) => ({ rank: i + 1, topic, count }));
  }

  breaking() {
    const critical = this.listArticles().find(
      (a) => a.importance === 'critical' || a.importance === 'high',
    );
    if (!critical) return null;
    return {
      articleId: critical.id,
      headline: critical.headline,
      publishedAt: critical.publishedAt.toISOString(),
    };
  }

  async upsertArticles(records: ArticleRecord[]) {
    for (const record of records) {
      this.articles.set(record.id, record);
    }
    if (!this.dbReady) return;
    await this.prisma.article.createMany({
      data: records.map((r) => ({
        id: r.id,
        headline: r.headline,
        excerpt: r.excerpt,
        body: r.body,
        source: r.source,
        sourceDomain: r.sourceDomain,
        url: r.url,
        category: r.category,
        publishedAt: r.publishedAt,
        imageUrl: r.imageUrl,
        sentiment: r.sentiment,
        bias: r.bias,
        importance: r.importance,
        storyClusterId: r.storyClusterId,
        tone: r.tone,
      })),
      skipDuplicates: true,
    });
  }

  listBookmarks(userId = 'local') {
    return [...this.bookmarks.values()].filter((b) => b.userId === userId);
  }

  async putBookmarks(articleIds: string[], userId = 'local') {
    const wanted = new Set(articleIds);
    for (const [key, b] of [...this.bookmarks.entries()]) {
      if (b.userId === userId && !wanted.has(b.articleId)) this.bookmarks.delete(key);
    }
    for (const articleId of articleIds) {
      const key = this.bookmarkKey(userId, articleId);
      this.bookmarks.set(key, {
        id: key,
        userId,
        articleId,
        createdAt: new Date(),
      });
    }
    if (!this.dbReady) return { ok: true, articleIds };
    await this.prisma.$transaction(async (tx) => {
      await tx.bookmark.deleteMany({
        where: { userId, articleId: { notIn: articleIds } },
      });
      for (const articleId of articleIds) {
        if (!this.articles.has(articleId)) continue;
        await tx.bookmark.upsert({
          where: { userId_articleId: { userId, articleId } },
          create: { userId, articleId },
          update: {},
        });
      }
    });
    return { ok: true, articleIds };
  }

  getSummary(topicName: string) {
    return this.summaries.get(topicName.toLowerCase()) ?? null;
  }

  listSummaries() {
    return [...this.summaries.values()];
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
    return this.prisma.rssFeed.upsert({
      where: { url: feed.url },
      create: {
        id: feed.id,
        title: feed.title,
        url: feed.url,
        description: feed.description,
        category: feed.category,
        isActive: feed.isActive,
        lastChecked: feed.lastChecked,
        itemCount: feed.itemCount,
        addedAt: feed.addedAt,
      },
      update: {
        title: feed.title,
        description: feed.description,
        category: feed.category,
        isActive: feed.isActive,
        lastChecked: feed.lastChecked,
        itemCount: feed.itemCount,
      },
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
    const update = {
      id: `upd-${Date.now()}`,
      eventId,
      timestamp: new Date(),
      message,
      importance,
      sources: [] as string[],
    };
    event.updates = [update, ...(event.updates ?? [])];
    event.lastUpdated = new Date();
    this.events.set(eventId, event);
    if (this.dbReady) {
      await this.prisma.eventUpdate.create({
        data: { eventId, message, importance, sources: [] },
      });
    }
    return { event, update };
  }

  private bookmarkKey(userId: string, articleId: string) {
    return `${userId}:${articleId}`;
  }

  private mapArticle(a: {
    id: string;
    headline: string;
    excerpt: string;
    body: string | null;
    source: string;
    sourceDomain: string | null;
    url: string | null;
    category: string;
    publishedAt: Date;
    imageUrl: string | null;
    sentiment: string | null;
    bias: string | null;
    importance: string;
    storyClusterId: string | null;
    tone: number | null;
  }): ArticleRecord {
    return { ...a };
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
