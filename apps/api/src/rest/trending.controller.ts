import { Controller, Get } from '@nestjs/common';
import { NewsStore } from '../store/news.store';

@Controller('trending')
export class TrendingController {
  constructor(private readonly store: NewsStore) {}

  @Get()
  async trending() {
    return { topics: await this.store.trendingTopics() };
  }
}
