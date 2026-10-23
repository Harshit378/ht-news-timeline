import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NewsStore } from '../store/news.store';
import { GdeltBigQueryService } from './gdelt-bigquery.service';
import { GdeltDocService } from './gdelt-doc.service';
import { SummariesService } from '../summaries/summaries.service';

@Injectable()
export class IngestionScheduler implements OnModuleInit {
  private readonly logger = new Logger(IngestionScheduler.name);
  private running = false;

  constructor(
    private readonly gdelt: GdeltDocService,
    private readonly bigQuery: GdeltBigQueryService,
    private readonly store: NewsStore,
    private readonly summaries: SummariesService,
  ) {}

  async onModuleInit() {
    await this.store.init();
    void this.refreshNews();
  }

  @Cron('*/15 * * * *')
  async refreshNews() {
    if (this.running) return;
    this.running = true;
    try {
      const articles = await this.gdelt.ingestAllCategories((batch) =>
        this.store.upsertArticles(batch),
      );
      this.logger.log(`Stored ${articles.length} GDELT articles`);
      await this.bigQuery.queryRecentEvents();
    } catch (err) {
      this.logger.warn(`Ingest failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      this.running = false;
    }
  }

  @Cron('0 */4 * * *')
  async refreshSummaries() {
    await this.summaries.generateAll();
  }
}
