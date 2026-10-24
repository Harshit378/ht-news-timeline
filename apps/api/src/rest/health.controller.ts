import { Controller, Get, Inject } from '@nestjs/common';
import { NEWS_PROVIDERS, NewsProvider } from '../ingestion/providers/news-provider';
import { PrismaService } from '../prisma/prisma.service';
import { NewsStore } from '../store/news.store';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: NewsStore,
    @Inject(NEWS_PROVIDERS) private readonly providers: NewsProvider[],
  ) {}

  @Get()
  async health() {
    const postgres = await this.prisma.isReady();
    const feeds = this.store.listFeeds();
    return {
      ok: true,
      database: postgres ? 'postgres' : 'memory',
      /** 'pending' = database reachable but `pnpm db:deploy` has not been run. */
      migrations: this.prisma.migrationState(),
      ...(postgres && { counts: await this.store.stats() }),
      providers: this.providers.map((p) => p.status()),
      rss: {
        active: feeds.filter((f) => f.isActive).length,
        failing: feeds.filter((f) => f.isActive && f.failureCount > 0).length,
      },
    };
  }
}
