import { Controller, Get, Query } from '@nestjs/common';
import { NewsStore } from '../store/news.store';
import { serializeArticle } from './serialize';

@Controller('feed')
export class FeedController {
  constructor(private readonly store: NewsStore) {}

  @Get()
  getFeed(@Query('category') category?: string, @Query('page') page = '1') {
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = 20;
    const all = this.store.listArticles(category);
    const start = (pageNum - 1) * pageSize;
    const slice = all.slice(start, start + pageSize);
    return {
      category: category ?? null,
      items: slice.map(serializeArticle),
      page: pageNum,
      pageSize,
      hasMore: start + pageSize < all.length,
    };
  }
}
