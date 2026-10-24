import { Injectable } from '@nestjs/common';
import { ArticleRecord } from '../../store/types';
import { GdeltDocService } from '../gdelt-doc.service';
import { NewsProvider } from './news-provider';

/** GDELT DOC 2.0: hourly category ingestion and ≤ 1-week story discovery. */
@Injectable()
export class GdeltDocProvider implements NewsProvider {
  readonly id = 'gdelt-doc';

  constructor(private readonly gdelt: GdeltDocService) {}

  async fetchLatest(onBatch: (batch: ArticleRecord[]) => Promise<void>) {
    return (await this.gdelt.ingestAllCategories(onBatch)).length;
  }

  search(query: string, opts: { category?: string }) {
    return this.gdelt.searchRecent(query, opts.category);
  }

  status() {
    return { id: this.id, ...this.gdelt.status() };
  }
}
