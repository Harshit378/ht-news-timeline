import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createHash } from 'crypto';
import { normalizeArticleUrl } from '../../rss/rss-ingestion.service';
import { clipText } from '../../rss/rss.service';
import { ArticleRecord } from '../../store/types';
import { sanitizeStoryQuery } from '../gdelt-doc.service';
import { UsageTracker, dayPeriod } from '../usage-tracker';
import { NewsProvider, ProviderStatus } from './news-provider';

/** One article in TheNewsAPI's `/v1/news/all` response. */
export interface NewsApiArticle {
  uuid?: string;
  title?: string;
  description?: string;
  snippet?: string;
  url?: string;
  image_url?: string | null;
  published_at?: string;
  source?: string;
  categories?: string[];
}

const DEFAULT_BASE = 'https://api.thenewsapi.com/v1';
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX = 200;

/** Our categories → TheNewsAPI's. Unmapped categories search everything. */
const TO_VENDOR: Record<string, string> = {
  world: 'general',
  tech: 'tech',
  finance: 'business',
  science: 'science',
  politics: 'politics',
  health: 'health',
  culture: 'entertainment',
  sports: 'sports',
};
const FROM_VENDOR: Record<string, string> = {
  general: 'world',
  tech: 'tech',
  business: 'finance',
  science: 'science',
  politics: 'politics',
  health: 'health',
  entertainment: 'culture',
  sports: 'sports',
};

export function toArticleRecord(a: NewsApiArticle, fallbackCategory = 'world', now = new Date()): ArticleRecord | null {
  if (!a.url || !a.title) return null;
  const url = normalizeArticleUrl(a.url);
  const t = Date.parse(a.published_at ?? '');
  const publishedAt = Number.isFinite(t) && t <= now.getTime() ? new Date(t) : now;
  let domain: string | null = null;
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // keep null
  }
  const category = a.categories?.map((c) => FROM_VENDOR[c]).find(Boolean) ?? fallbackCategory;
  const excerpt = clipText((a.description || a.snippet || a.title).replace(/\s+/g, ' ').trim());
  return {
    // Same id scheme as RSS and GDELT (sha1 of the normalized URL), so duplicates collapse.
    id: createHash('sha1').update(url).digest('hex').slice(0, 16),
    headline: a.title.trim(),
    excerpt,
    body: null,
    source: a.source || domain || 'News API',
    sourceDomain: a.source || domain,
    url,
    category,
    publishedAt,
    imageUrl: a.image_url || null,
    sentiment: null,
    bias: null,
    importance: 'normal',
    storyClusterId: `${category}-${publishedAt.toISOString().slice(0, 10)}`,
    tone: null,
  };
}

/**
 * Commercial News Search API (ADR-008 step 3), in TheNewsAPI's format. Off unless `NEWS_API_KEY` is set.
 * Requests are capped per UTC day (`NEWS_API_DAILY_LIMIT`, default 100 = the free tier) and identical
 * queries are cached for 15 minutes. Over quota it returns nothing rather than failing, so story search
 * isn't marked degraded.
 */
@Injectable()
export class NewsSearchApiProvider implements NewsProvider {
  readonly id = 'news-api';
  private readonly logger = new Logger(NewsSearchApiProvider.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly dailyLimit: number;
  private readonly pageSize: number;
  private readonly cache = new Map<string, { at: number; items: ArticleRecord[] }>();
  private lastSuccessAt: Date | null = null;
  private lastError: string | null = null;
  private usedToday = 0;

  constructor(
    private readonly usage: UsageTracker,
    env: NodeJS.ProcessEnv = process.env,
  ) {
    this.apiKey = env.NEWS_API_KEY || undefined;
    this.baseUrl = (env.NEWS_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
    this.dailyLimit = Number(env.NEWS_API_DAILY_LIMIT) || 100;
    this.pageSize = Number(env.NEWS_API_PAGE_SIZE) || 25;
  }

  get enabled() {
    return Boolean(this.apiKey);
  }

  async search(query: string, opts: { category?: string }): Promise<ArticleRecord[]> {
    if (!this.apiKey) return [];
    const search = sanitizeStoryQuery(query);
    if (!search) return [];
    const key = `${search.toLowerCase()}|${opts.category ?? ''}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.items;

    const period = dayPeriod();
    this.usedToday = await this.usage.get(this.id, period);
    if (this.usedToday >= this.dailyLimit) {
      this.logger.warn(`daily quota used (${this.usedToday}/${this.dailyLimit}); skipping "${search}"`);
      return [];
    }
    this.usedToday = await this.usage.add(this.id, period, 1);

    const vendorCategory = opts.category ? TO_VENDOR[opts.category] : undefined;
    try {
      const { data } = await axios.get<{ data?: NewsApiArticle[] }>(`${this.baseUrl}/news/all`, {
        params: {
          api_token: this.apiKey,
          search,
          language: 'en',
          sort: 'published_at',
          limit: this.pageSize,
          ...(vendorCategory && { categories: vendorCategory }),
        },
        timeout: 15_000,
      });
      const now = new Date();
      const items = (data.data ?? [])
        .map((a) => toArticleRecord(a, opts.category ?? 'world', now))
        .filter((a): a is ArticleRecord => a !== null);
      this.remember(key, items);
      this.lastSuccessAt = now;
      this.lastError = null;
      return items;
    } catch (err) {
      // Never log the request URL: it carries the API token.
      this.lastError = axios.isAxiosError(err)
        ? err.response
          ? `HTTP ${err.response.status}`
          : (err.code ?? 'network error')
        : String(err);
      throw new Error(`news-api: ${this.lastError}`);
    }
  }

  status(): ProviderStatus & { quota?: { used: number; limit: number } } {
    return {
      id: this.id,
      state: !this.apiKey ? 'disabled' : this.lastError && !this.lastSuccessAt ? 'error' : 'ok',
      lastSuccessAt: this.lastSuccessAt?.toISOString() ?? null,
      lastError: this.apiKey ? this.lastError : 'NEWS_API_KEY not set',
      ...(this.apiKey && { quota: { used: this.usedToday, limit: this.dailyLimit } }),
    };
  }

  private remember(key: string, items: ArticleRecord[]) {
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
    this.cache.set(key, { at: Date.now(), items });
  }
}
