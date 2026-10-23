import { Controller, Get } from '@nestjs/common';
import { NewsStore } from '../store/news.store';

@Controller('trending')
export class TrendingController {
  constructor(private readonly store: NewsStore) {}

  @Get()
  trending() {
    return { topics: this.store.trendingTopics() };
  }
}
