import { ArticleRecord } from '../../store/types';

export interface ProviderStatus {
  id: string;
  state: 'ok' | 'cooldown' | 'error' | 'disabled';
  cooldownUntil?: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

/**
 * One upstream news source (ADR-008). Feed ingestion calls `fetchLatest`; story timelines call
 * `search`. Sources implement whichever they support, so vendors can be swapped or added
 * (e.g. a News Search API) without touching controllers.
 */
export interface NewsProvider {
  readonly id: string;
  /** False when the provider isn't configured (e.g. no API key); search skips it. Defaults to true. */
  readonly enabled?: boolean;
  /** Pulls recent articles for the home feed; `onBatch` stores them as they land. Returns the count. */
  fetchLatest?(onBatch: (batch: ArticleRecord[]) => Promise<void>): Promise<number>;
  /** Recent coverage of a story query. */
  search?(query: string, opts: { category?: string }): Promise<ArticleRecord[]>;
  status(): ProviderStatus;
}

export const NEWS_PROVIDERS = Symbol('NEWS_PROVIDERS');
