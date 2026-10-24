import { Controller, Get, Query } from '@nestjs/common';
import { NewsStore } from '../store/news.store';
import { serializeArticle } from './serialize';

@Controller('search')
export class SearchController {
  constructor(private readonly store: NewsStore) {}

  @Get()
  async search(@Query('q') q?: string) {
    const results = await this.store.searchArticles(q ?? '');
    return {
      query: q ?? '',
      results: results.map(serializeArticle),
    };
  }
}
