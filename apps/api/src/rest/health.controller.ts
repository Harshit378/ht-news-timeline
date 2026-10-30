import { Controller, Get, Inject } from '@nestjs/common';
import { GdeltBigQueryService } from '../ingestion/gdelt-bigquery.service';
import { NEWS_PROVIDERS, NewsProvider } from '../ingestion/providers/news-provider';
import { LLM_PROVIDER, LlmProvider } from '../llm/llm-provider';
import { PrismaService } from '../prisma/prisma.service';
import { NewsStore } from '../store/news.store';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: NewsStore,
    @Inject(NEWS_PROVIDERS) private readonly providers: NewsProvider[],
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly bigQuery: GdeltBigQueryService,
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
      llm: await this.llm.status(),
      /** BigQuery history backfill (ADR-008 step 5): bytes scanned this month vs the budget. */
      bigquery: this.bigQuery.enabled ? { state: 'on', month: await this.bigQuery.monthlyUsage() } : { state: 'disabled' },
      rss: {
        active: feeds.filter((f) => f.isActive).length,
        failing: feeds.filter((f) => f.isActive && f.failureCount > 0).length,
      },
    };
  }
}
