import { Module } from '@nestjs/common';
import { RssModule } from '../rss/rss.module';
import { SummariesModule } from '../summaries/summaries.module';
import { GdeltBigQueryService } from './gdelt-bigquery.service';
import { GdeltDocService } from './gdelt-doc.service';
import { IngestionScheduler } from './ingestion.scheduler';
import { NewsSearchService } from './news-search.service';
import { GdeltDocProvider } from './providers/gdelt-doc.provider';
import { NEWS_PROVIDERS } from './providers/news-provider';
import { RssProvider } from './providers/rss.provider';

@Module({
  imports: [SummariesModule, RssModule],
  providers: [
    GdeltDocService,
    GdeltBigQueryService,
    GdeltDocProvider,
    RssProvider,
    {
      provide: NEWS_PROVIDERS,
      useFactory: (gdelt: GdeltDocProvider, rss: RssProvider) => [rss, gdelt],
      inject: [GdeltDocProvider, RssProvider],
    },
    NewsSearchService,
    IngestionScheduler,
  ],
  exports: [NewsSearchService, NEWS_PROVIDERS],
})
export class IngestionModule {}
