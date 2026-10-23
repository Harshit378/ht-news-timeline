import { Controller, Get } from '@nestjs/common';
import { NewsStore } from '../store/news.store';

@Controller('breaking')
export class BreakingController {
  constructor(private readonly store: NewsStore) {}

  @Get()
  breaking() {
    return { active: this.store.breaking() };
  }
}
