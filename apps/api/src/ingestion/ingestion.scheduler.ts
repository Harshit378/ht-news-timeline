import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RssIngestionService } from '../rss/rss-ingestion.service';
import { NewsStore } from '../store/news.store';
import { NEWS_PROVIDERS, NewsProvider } from './providers/news-provider';
import { SummariesService } from '../summaries/summaries.service';

@Injectable()
export class IngestionScheduler implements OnModuleInit {
  private readonly logger = new Logger(IngestionScheduler.name);
  private readonly running = new Set<string>();

  constructor(
    @Inject(NEWS_PROVIDERS) private readonly providers: NewsProvider[],
    private readonly rss: RssIngestionService,
    private readonly store: NewsStore,
    private readonly summaries: SummariesService,
  ) {}

  async onModuleInit() {
    await this.store.init();
    await this.rss.seedCurated();
    // RSS fills the feed within seconds; GDELT's rate-limited sweep follows.
    void this.refreshRss().then(() => this.refreshGdelt());
  }

  @Cron('*/10 * * * *')
  refreshRss() {
    return this.ingest('rss');
  }

  /** Hourly: RSS now carries the feed, so GDELT's 10 rate-limited category queries run less often. */
  @Cron('0 * * * *')
  async refreshGdelt() {
    await this.ingest('gdelt-doc');
  }

  @Cron('0 */4 * * *')
  async refreshSummaries() {
    await this.summaries.generateAll();
  }

  private async ingest(id: string) {
    const provider = this.providers.find((p) => p.id === id);
    if (!provider?.fetchLatest || this.running.has(id)) return;
    this.running.add(id);
    try {
      const count = await provider.fetchLatest((batch) => this.store.upsertArticles(batch));
      this.logger.log(`Stored ${count} ${id} articles`);
    } catch (err) {
      this.logger.warn(`${id} ingest failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      this.running.delete(id);
    }
  }
}
