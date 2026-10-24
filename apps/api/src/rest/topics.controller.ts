import { Controller, Get, Param } from '@nestjs/common';
import { NewsStore } from '../store/news.store';
import { serializeArticle } from './serialize';

const TOPICS = [
  { slug: 'tech', name: 'Technology' },
  { slug: 'world', name: 'World News' },
  { slug: 'finance', name: 'Finance' },
  { slug: 'science', name: 'Science' },
  { slug: 'politics', name: 'Politics' },
  { slug: 'climate', name: 'Climate' },
  { slug: 'health', name: 'Health' },
  { slug: 'culture', name: 'Culture' },
  { slug: 'sports', name: 'Sports' },
  { slug: 'opinion', name: 'Opinion' },
];

@Controller('topics')
export class TopicsController {
  constructor(private readonly store: NewsStore) {}

  @Get()
  async list() {
    const counts = new Map((await this.store.trendingTopics()).map((t) => [t.topic, t.count]));
    return {
      topics: TOPICS.map((t) => ({
        ...t,
        count: counts.get(t.slug) ?? 0,
      })),
    };
  }

  @Get(':slug/feed')
  async topicFeed(@Param('slug') slug: string) {
    const items = await this.store.listArticles(slug);
    return {
      slug,
      items: items.map(serializeArticle),
      page: 1,
      pageSize: items.length,
      hasMore: false,
    };
  }
}
