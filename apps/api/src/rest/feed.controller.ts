import { Controller, Get, Query } from '@nestjs/common';
import { NewsStore } from '../store/news.store';
import { parseRegion } from '../store/region';
import { serializeArticle } from './serialize';

@Controller('feed')
export class FeedController {
  constructor(private readonly store: NewsStore) {}

  @Get()
  async getFeed(@Query('category') category?: string, @Query('page') page = '1', @Query('region') region?: string) {
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = 20;
    // Fetch one extra row to learn whether another page exists without a COUNT.
    const rows = await this.store.listArticles(category, {
      skip: (pageNum - 1) * pageSize,
      take: pageSize + 1,
      // ADR-009: the reader's region ranks higher; unknown values are ignored rather than rejected.
      region: parseRegion(region),
    });
    return {
      category: category ?? null,
      region: parseRegion(region),
      items: rows.slice(0, pageSize).map(serializeArticle),
      page: pageNum,
      pageSize,
      hasMore: rows.length > pageSize,
    };
  }
}
