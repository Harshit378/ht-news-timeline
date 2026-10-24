import { Injectable, Logger } from '@nestjs/common';
import { RssIngestionService } from '../../rss/rss-ingestion.service';
import { ArticleRecord } from '../../store/types';
import { NewsProvider, ProviderStatus } from './news-provider';

/** Curated + user RSS feeds. No remote search: the stored archive is searched through the DB. */
@Injectable()
export class RssProvider implements NewsProvider {
  readonly id = 'rss';
  private readonly logger = new Logger(RssProvider.name);
  private lastSuccessAt: Date | null = null;
  private lastError: string | null = null;

  constructor(private readonly ingestion: RssIngestionService) {}

  async fetchLatest(onBatch: (batch: ArticleRecord[]) => Promise<void>) {
    const r = await this.ingestion.pollAll(onBatch);
    this.logger.log(
      `RSS polled ${r.polled} feeds: ${r.articles} items, ${r.notModified} not modified, ${r.failed} failed`,
    );
    if (r.polled > 0 && r.failed === r.polled) {
      this.lastError = `all ${r.polled} feeds failed`;
    } else {
      this.lastError = r.failed ? `${r.failed} of ${r.polled} feeds failed` : null;
      this.lastSuccessAt = new Date();
    }
    return r.articles;
  }

  status(): ProviderStatus {
    return {
      id: this.id,
      state: this.lastError && !this.lastSuccessAt ? 'error' : 'ok',
      lastSuccessAt: this.lastSuccessAt?.toISOString() ?? null,
      lastError: this.lastError,
    };
  }
}
