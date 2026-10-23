import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createHash } from 'crypto';
import { ArticleRecord } from '../store/types';

const CATEGORY_QUERIES: { slug: string; query: string }[] = [
  { slug: 'tech', query: 'technology OR AI OR semiconductor' },
  { slug: 'world', query: 'diplomacy OR "united nations" OR geopolitics' },
  { slug: 'finance', query: 'markets OR inflation OR "central bank"' },
  { slug: 'science', query: 'science OR NASA OR research' },
  { slug: 'politics', query: 'election OR parliament OR legislation' },
  { slug: 'climate', query: 'climate OR emissions OR "renewable energy"' },
  { slug: 'health', query: 'health OR WHO OR vaccine' },
  { slug: 'culture', query: 'film OR music OR literature' },
  { slug: 'sports', query: 'soccer OR olympics OR cricket' },
  { slug: 'opinion', query: 'opinion OR editorial' },
];

interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
  tone?: string;
}

/** GDELT DOC 2.0 allows one request per 5s per client; keep a safety margin. */
const MIN_REQUEST_GAP_MS = 5500;
const DOC_API_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';

/** Interactive story lookups jump ahead of background category ingestion. */
export enum GdeltPriority {
  Background = 0,
  Interactive = 10,
}

interface QueuedRequest {
  priority: GdeltPriority;
  run: () => Promise<void>;
}

const MAX_RETRIES = 2;
/** 3-month windows are slow on GDELT's side. */
const STORY_TIMEOUT_MS = 45_000;
const RETRY_BACKOFF_MS = 6000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryable(err: unknown) {
  if (!axios.isAxiosError(err)) return false;
  if (err.response?.status === 429 || (err.response?.status ?? 0) >= 500) return true;
  // Timeouts are not retried: a slow window will just be slow again.
  return err.code === 'ECONNRESET' || /socket hang up/i.test(err.message);
}

/**
 * Strips GDELT operators/punctuation (a leading "-" would mean NOT) and words
 * GDELT rejects as too short.
 */
export function sanitizeStoryQuery(q: string): string {
  return q
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .slice(0, 8)
    .join(' ');
}

function toneToSentiment(tone: number): 'positive' | 'neutral' | 'negative' {
  if (tone > 1.5) return 'positive';
  if (tone < -1.5) return 'negative';
  return 'neutral';
}

function importanceFromTone(tone: number, mentionsHint = 1): 'critical' | 'high' | 'normal' | 'low' {
  const mag = Math.abs(tone) + mentionsHint / 10;
  if (mag >= 8) return 'critical';
  if (mag >= 4) return 'high';
  if (mag >= 1.5) return 'normal';
  return 'low';
}

@Injectable()
export class GdeltDocService {
  private readonly logger = new Logger(GdeltDocService.name);
  private readonly http = axios.create({
    headers: { 'User-Agent': 'NewsTimeline/0.1' },
  });

  private readonly queue: QueuedRequest[] = [];
  private draining = false;
  private lastRequestAt = 0;

  /**
   * Category requests are spaced by the shared rate-limit queue (MIN_REQUEST_GAP_MS).
   * `onBatch` lets callers store each category as it lands instead of after all 10 (~minutes).
   */
  async ingestAllCategories(
    onBatch?: (batch: ArticleRecord[]) => Promise<void>,
  ): Promise<ArticleRecord[]> {
    const collected: ArticleRecord[] = [];
    for (const { slug, query } of CATEGORY_QUERIES) {
      try {
        const batch = await this.fetchArticles(
          // GDELT requires OR'd terms to be parenthesised.
          { query: `(${query}) sourcelang:english`, maxrecords: 15, timespan: '1d', sort: 'DateDesc' },
          slug,
          GdeltPriority.Background,
        );
        collected.push(...batch);
        this.logger.log(`GDELT ${slug}: ${batch.length} articles`);
        if (batch.length > 0) await onBatch?.(batch);
      } catch (err) {
        this.logger.warn(
          `GDELT ${slug} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return collected;
  }

  /**
   * Coverage of a story across GDELT's rolling 3-month DOC window.
   * Two passes: DateAsc finds where the story began; HybridRel adds the most relevant
   * reporting across the whole window (weighted toward recent), so the timeline reaches "now".
   */
  async searchStory(q: string, category = 'world'): Promise<ArticleRecord[]> {
    const query = sanitizeStoryQuery(q);
    if (!query) return [];
    const base = { query: `${query} sourcelang:english`, timespan: '3months' };
    const origin = await this.fetchArticles(
      { ...base, maxrecords: 75, sort: 'DateAsc' },
      category,
      GdeltPriority.Interactive,
      STORY_TIMEOUT_MS,
    );
    let developments: ArticleRecord[] = [];
    try {
      developments = await this.fetchArticles(
        { ...base, maxrecords: 175, sort: 'HybridRel' },
        category,
        GdeltPriority.Interactive,
        STORY_TIMEOUT_MS,
      );
    } catch (err) {
      // Origin results alone still make a usable timeline.
      this.logger.warn(`GDELT story "${query}" relevance pass failed: ${err instanceof Error ? err.message : err}`);
    }
    return [...origin, ...developments];
  }

  private async fetchArticles(
    params: Record<string, string | number>,
    category: string,
    priority: GdeltPriority,
    timeoutMs = 20_000,
  ): Promise<ArticleRecord[]> {
    const request = () =>
      this.http.get(DOC_API_URL, {
        params: { mode: 'ArtList', format: 'json', ...params },
        timeout: timeoutMs,
      });
    let data: unknown;
    for (let attempt = 0; ; attempt += 1) {
      try {
        ({ data } = await this.schedule(request, priority));
        break;
      } catch (err) {
        // GDELT throttles with 429 or by dropping the socket; back off and re-queue.
        if (attempt >= MAX_RETRIES || !isRetryable(err)) throw err;
        await sleep(RETRY_BACKOFF_MS * (attempt + 1));
      }
    }
    // GDELT answers errors (rate limit, bad query) with a plain-text body instead of JSON.
    if (typeof data === 'string') {
      throw new Error(`GDELT: ${data.trim().slice(0, 160) || 'empty response'}`);
    }
    const articles = (data as { articles?: unknown } | null)?.articles;
    const raw: GdeltArticle[] = Array.isArray(articles) ? articles : [];
    return raw
      .filter((a) => a.title && a.url)
      .map((a) => this.toRecord(a, category));
  }

  private schedule<T>(fn: () => Promise<T>, priority: GdeltPriority): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const job: QueuedRequest = { priority, run: () => fn().then(resolve, reject) };
      const at = this.queue.findIndex((q) => q.priority < priority);
      if (at === -1) this.queue.push(job);
      else this.queue.splice(at, 0, job);
      void this.drain();
    });
  }

  private async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const wait = this.lastRequestAt + MIN_REQUEST_GAP_MS - Date.now();
        if (wait > 0) await sleep(wait);
        const job = this.queue.shift();
        if (!job) break;
        await job.run();
        // GDELT counts the gap from when a request finishes (responses can take 10s+).
        this.lastRequestAt = Date.now();
      }
    } finally {
      this.draining = false;
    }
  }

  private toRecord(a: GdeltArticle, category: string): ArticleRecord {
    const tone = a.tone ? Number.parseFloat(a.tone) : 0;
    const publishedAt = this.parseSeen(a.seendate);
    const id = createHash('sha1').update(a.url ?? a.title ?? '').digest('hex').slice(0, 16);
    const domain = a.domain ?? 'gdelt';
    return {
      id,
      headline: a.title ?? 'Untitled',
      excerpt: a.title ?? '',
      body: a.title ?? '',
      source: domain,
      sourceDomain: domain,
      url: a.url ?? null,
      category,
      publishedAt,
      imageUrl: a.socialimage || null,
      sentiment: toneToSentiment(Number.isFinite(tone) ? tone : 0),
      bias: 'center',
      importance: importanceFromTone(Number.isFinite(tone) ? tone : 0),
      storyClusterId: `${category}-${publishedAt.toISOString().slice(0, 10)}`,
      tone: Number.isFinite(tone) ? tone : null,
    };
  }

  private parseSeen(seendate?: string) {
    if (!seendate) return new Date();
    const m = seendate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    if (!m) return new Date();
    return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
  }
}
