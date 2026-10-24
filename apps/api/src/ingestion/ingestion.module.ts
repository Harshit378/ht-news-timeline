import { Module } from '@nestjs/common';
import { RssModule } from '../rss/rss.module';
import { SummariesModule } from '../summaries/summaries.module';
import { GdeltBigQueryService } from './gdelt-bigquery.service';
import { GdeltDocService } from './gdelt-doc.service';
import { IngestionScheduler } from './ingestion.scheduler';
import { NewsSearchService } from './news-search.service';
import { GdeltDocProvider } from './providers/gdelt-doc.provider';
import { NewsSearchApiProvider } from './providers/news-search-api.provider';
import { NEWS_PROVIDERS } from './providers/news-provider';
import { RssProvider } from './providers/rss.provider';
import { UsageTracker } from './usage-tracker';

@Module({
  imports: [SummariesModule, RssModule],
  providers: [
    GdeltDocService,
    GdeltBigQueryService,
    GdeltDocProvider,
    RssProvider,
    UsageTracker,
    { provide: NewsSearchApiProvider, useFactory: (usage: UsageTracker) => new NewsSearchApiProvider(usage), inject: [UsageTracker] },
    {
      provide: NEWS_PROVIDERS,
      useFactory: (gdelt: GdeltDocProvider, rss: RssProvider, newsApi: NewsSearchApiProvider) => [rss, newsApi, gdelt],
      inject: [GdeltDocProvider, RssProvider, NewsSearchApiProvider],
    },
    NewsSearchService,
    IngestionScheduler,
  ],
  exports: [NewsSearchService, NEWS_PROVIDERS, UsageTracker],
})
export class IngestionModule {}
