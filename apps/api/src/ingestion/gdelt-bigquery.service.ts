import { Injectable, Logger } from '@nestjs/common';
import { BigQuery } from '@google-cloud/bigquery';
import { createHash } from 'crypto';
import { normalizeArticleUrl } from '../rss/rss-ingestion.service';
import { ArticleRecord } from '../store/types';
import { sanitizeStoryQuery } from './gdelt-doc.service';
import { UsageTracker, monthPeriod } from './usage-tracker';

export const BQ_USAGE_ID = 'bigquery';
const GB = 1024 ** 3;

/** One GKG row as selected by `buildBackfillQuery`. */
export interface GkgRow {
  DATE: number | string;
  DocumentIdentifier: string;
  SourceCommonName: string | null;
  V2Tone: string | null;
  title: string | null;
}

/** The slice of the BigQuery client used here, so tests can pass a fake. */
export interface BigQueryLike {
  createQueryJob(options: Record<string, unknown>): Promise<[{ metadata: { statistics?: { totalBytesProcessed?: string } } }, ...unknown[]]>;
  query(options: Record<string, unknown>): Promise<[unknown[], ...unknown[]]>;
}

export interface BackfillResult {
  status: 'done' | 'unavailable';
  articles: ArticleRecord[];
  bytes: number;
  /** Why slices were skipped or the run stopped early, for logs and health. */
  notes: string[];
}

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };

/** GKG page titles carry raw HTML entities ("Q&amp;A", "&#39;"). */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Lower-cased words of 3+ letters, regex-escaped: every one must appear in the page title. */
export function queryTerms(query: string): string[] {
  return sanitizeStoryQuery(query)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w))
    .slice(0, 5)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

/**
 * Partition-pruned GKG query for one time slice (ADR-003 Pipeline B). Only the five needed columns are
 * read; matching is on the article's page title (`<PAGE_TITLE>` in Extras), which keeps results on-topic.
 */
export function buildBackfillQuery(terms: string[], start: Date, end: Date, limit = 200) {
  const titleExpr = "LOWER(REGEXP_EXTRACT(Extras, r'<PAGE_TITLE>(.*?)</PAGE_TITLE>'))";
  const conditions = terms.map((_, i) => `REGEXP_CONTAINS(${titleExpr}, @t${i})`).join(' AND ');
  const query = `
SELECT DATE, DocumentIdentifier, SourceCommonName, V2Tone,
  REGEXP_EXTRACT(Extras, r'<PAGE_TITLE>(.*?)</PAGE_TITLE>') AS title
FROM \`gdelt-bq.gdeltv2.gkg_partitioned\`
WHERE _PARTITIONTIME >= TIMESTAMP(@start) AND _PARTITIONTIME < TIMESTAMP(@end)
  AND ${conditions}
ORDER BY DATE
LIMIT ${Math.max(1, Math.min(1000, Math.floor(limit)))}`.trim();
  const params: Record<string, string> = { start: start.toISOString(), end: end.toISOString() };
  terms.forEach((t, i) => (params[`t${i}`] = `\\b${t}`));
  return { query, params };
}

/** GDELT DATE is YYYYMMDDHHMMSS. */
export function gdeltDate(raw: number | string): Date | null {
  const s = String(raw);
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function rowToArticle(row: GkgRow, category = 'world'): ArticleRecord | null {
  const title = row.title ? decodeEntities(row.title).replace(/\s+/g, ' ').trim() : '';
  const publishedAt = gdeltDate(row.DATE);
  if (!title || !publishedAt || !/^https?:\/\//.test(row.DocumentIdentifier ?? '')) return null;
  const url = normalizeArticleUrl(row.DocumentIdentifier);
  const tone = Number((row.V2Tone ?? '').split(',')[0]);
  const source = row.SourceCommonName || new URL(url).hostname.replace(/^www\./, '');
  return {
    id: createHash('sha1').update(url).digest('hex').slice(0, 16),
    headline: title,
    excerpt: title,
    body: null,
    source,
    sourceDomain: row.SourceCommonName,
    url,
    category,
    publishedAt,
    imageUrl: null,
    sentiment: Number.isFinite(tone) ? (tone > 1.5 ? 'positive' : tone < -1.5 ? 'negative' : 'neutral') : null,
    bias: null,
    importance: 'normal',
    storyClusterId: `${category}-${publishedAt.toISOString().slice(0, 10)}`,
    tone: Number.isFinite(tone) ? tone : null,
  };
}

/**
 * Deep history for a story from GDELT on BigQuery (ADR-003 Pipeline B, ADR-008 step 5).
 * Runs only with Google credentials (`GOOGLE_APPLICATION_CREDENTIALS`, or ADC with `GDELT_BIGQUERY=on`).
 * Cost guards: each slice is dry-run first and skipped above `BQ_MAX_BYTES_PER_QUERY` (default 20 GB),
 * `maximumBytesBilled` enforces the same cap server-side, and scanned bytes are counted per month in
 * `ProviderUsage` up to `BQ_MONTHLY_BYTES` (default 900 GB, under the 1 TB free tier).
 */
@Injectable()
export class GdeltBigQueryService {
  private readonly logger = new Logger(GdeltBigQueryService.name);
  readonly enabled: boolean;
  private readonly maxBytesPerQuery: number;
  private readonly monthlyBytes: number;
  private readonly sliceDays: number;
  private readonly maxSlices: number;
  private client: BigQueryLike | null;

  constructor(
    private readonly usage: UsageTracker,
    env: NodeJS.ProcessEnv = process.env,
    client?: BigQueryLike,
  ) {
    this.enabled = Boolean(client || env.GOOGLE_APPLICATION_CREDENTIALS || env.GDELT_BIGQUERY === 'on');
    this.maxBytesPerQuery = Number(env.BQ_MAX_BYTES_PER_QUERY) || 20 * GB;
    this.monthlyBytes = Number(env.BQ_MONTHLY_BYTES) || 900 * GB;
    this.sliceDays = Number(env.BQ_SLICE_DAYS) || 7;
    this.maxSlices = Number(env.BQ_MAX_SLICES) || 8;
    this.client = client ?? null;
  }

  mapImportance(goldsteinScale: number, numMentions: number): 'critical' | 'high' | 'normal' | 'low' {
    if (Math.abs(goldsteinScale) >= 7 || numMentions >= 200) return 'critical';
    if (Math.abs(goldsteinScale) >= 4 || numMentions >= 80) return 'high';
    if (Math.abs(goldsteinScale) >= 1 || numMentions >= 20) return 'normal';
    return 'low';
  }

  async monthlyUsage() {
    return { used: await this.usage.get(BQ_USAGE_ID, monthPeriod()), limit: this.monthlyBytes };
  }

  /**
   * Walks back from `before` in `BQ_SLICE_DAYS` slices (at most `BQ_MAX_SLICES`), collecting matching
   * reports. Stops early when the monthly budget is reached. Never throws for budget reasons.
   */
  async backfillStory(query: string, before: Date, category?: string): Promise<BackfillResult> {
    const terms = queryTerms(query);
    if (!this.enabled || terms.length === 0) return { status: 'unavailable', articles: [], bytes: 0, notes: [] };
    const client = this.getClient();
    const notes: string[] = [];
    const byId = new Map<string, ArticleRecord>();
    let bytes = 0;
    let end = before;

    for (let i = 0; i < this.maxSlices; i++) {
      const start = new Date(end.getTime() - this.sliceDays * 86_400_000);
      const { query: sql, params } = buildBackfillQuery(terms, start, end);
      const span = `${start.toISOString().slice(0, 10)}..${end.toISOString().slice(0, 10)}`;
      end = start;

      const [dry] = await client.createQueryJob({ query: sql, params, dryRun: true, location: 'US' });
      const estimate = Number(dry.metadata.statistics?.totalBytesProcessed ?? 0);
      if (estimate > this.maxBytesPerQuery) {
        notes.push(`${span}: skipped, would scan ${(estimate / GB).toFixed(1)} GB`);
        continue;
      }
      const used = await this.usage.get(BQ_USAGE_ID, monthPeriod());
      if (used + estimate > this.monthlyBytes) {
        notes.push(`${span}: stopped, monthly budget reached (${(used / GB).toFixed(0)} GB used)`);
        break;
      }
      const [rows] = await client.query({
        query: sql,
        params,
        location: 'US',
        maximumBytesBilled: String(this.maxBytesPerQuery),
      });
      await this.usage.add(BQ_USAGE_ID, monthPeriod(), estimate);
      bytes += estimate;
      for (const row of rows as GkgRow[]) {
        const a = rowToArticle(row, category ?? 'world');
        if (a) byId.set(a.id, a);
      }
    }
    if (notes.length) this.logger.log(`backfill "${query}": ${notes.join('; ')}`);
    this.logger.log(`backfill "${query}": ${byId.size} reports, ${(bytes / GB).toFixed(2)} GB scanned`);
    return { status: 'done', articles: [...byId.values()], bytes, notes };
  }

  private getClient(): BigQueryLike {
    if (!this.client) this.client = new BigQuery() as unknown as BigQueryLike;
    return this.client;
  }
}
