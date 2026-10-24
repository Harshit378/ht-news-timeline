import { Inject, Injectable, Logger } from '@nestjs/common';
import { ArticleRecord } from '../store/types';
import { NEWS_PROVIDERS, NewsProvider } from './providers/news-provider';

const PROVIDER_TIMEOUT_MS = 25_000;

/** Fans a story query out to every provider that can search and merges what comes back. */
@Injectable()
export class NewsSearchService {
  private readonly logger = new Logger(NewsSearchService.name);
  /** Overridable in tests. */
  timeoutMs = PROVIDER_TIMEOUT_MS;

  constructor(@Inject(NEWS_PROVIDERS) private readonly providers: NewsProvider[]) {}

  /**
   * `degraded` is true when any provider failed or timed out; the rest still count.
   * Throws only when every provider failed.
   */
  async search(query: string, category?: string): Promise<{ items: ArticleRecord[]; degraded: boolean }> {
    const searchable = this.providers.filter((p) => p.search);
    const results = await Promise.allSettled(
      searchable.map((p) => this.withTimeout(p.search!(query, { category }), p.id)),
    );
    const items: ArticleRecord[] = [];
    const errors: unknown[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') items.push(...r.value);
      else {
        errors.push(r.reason);
        this.logger.warn(
          `search "${query}" via ${searchable[i].id} failed: ${r.reason instanceof Error ? r.reason.message : r.reason}`,
        );
      }
    });
    if (searchable.length > 0 && errors.length === searchable.length) throw errors[0];
    return { items, degraded: errors.length > 0 };
  }

  private withTimeout<T>(p: Promise<T>, id: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${id} timed out after ${this.timeoutMs}ms`)), this.timeoutMs);
    });
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
  }
}
