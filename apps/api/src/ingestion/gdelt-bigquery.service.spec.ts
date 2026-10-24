import { describe, expect, it, vi } from 'vitest';
import {
  BQ_USAGE_ID,
  GdeltBigQueryService,
  buildBackfillQuery,
  decodeEntities,
  gdeltDate,
  queryTerms,
  rowToArticle,
  type BigQueryLike,
} from './gdelt-bigquery.service';
import { StoryBackfillService } from './story-backfill.service';
import type { UsageTracker } from './usage-tracker';

const GB = 1024 ** 3;

function usage(startBytes = 0) {
  const amounts = new Map<string, number>();
  return {
    get: vi.fn(async (p: string, period: string) => amounts.get(`${p}:${period}`) ?? startBytes),
    add: vi.fn(async (p: string, period: string, n: number) => {
      const total = (amounts.get(`${p}:${period}`) ?? startBytes) + n;
      amounts.set(`${p}:${period}`, total);
      return total;
    }),
  } as unknown as UsageTracker & { add: ReturnType<typeof vi.fn> };
}

const ROW = {
  DATE: 20220224043000,
  DocumentIdentifier: 'https://www.reuters.com/world/europe/russia-ukraine-2022-02-24/?utm_source=x',
  SourceCommonName: 'reuters.com',
  V2Tone: '-6.2,1.1,7.3,8.4,22.1,0,512',
  title: 'Russia launches invasion of Ukraine &amp; Kyiv hit by missiles',
};

/** Fake client: dry runs report `bytesPerSlice`; real queries return `rows`. */
function fakeClient(bytesPerSlice: number, rows: unknown[] = [ROW]) {
  const createQueryJob = vi.fn(async () => [{ metadata: { statistics: { totalBytesProcessed: String(bytesPerSlice) } } }]);
  const query = vi.fn(async () => [rows]);
  return { client: { createQueryJob, query } as unknown as BigQueryLike, createQueryJob, query };
}

describe('query building', () => {
  it('extracts title terms, dropping short words and bare numbers, and escapes regex characters', () => {
    expect(queryTerms('Russia Ukraine war 2022')).toEqual(['russia', 'ukraine', 'war']);
    expect(queryTerms('a b')).toEqual([]);
  });

  it('prunes partitions to the slice, reads only needed columns, and parameterizes every term', () => {
    const { query, params } = buildBackfillQuery(['russia', 'ukraine'], new Date('2022-02-17T00:00:00Z'), new Date('2022-02-24T00:00:00Z'));
    expect(query).toContain('_PARTITIONTIME >= TIMESTAMP(@start) AND _PARTITIONTIME < TIMESTAMP(@end)');
    expect(query).toContain('REGEXP_CONTAINS(');
    expect(query).not.toMatch(/SELECT \*/);
    expect(query).not.toContain('russia'); // terms only travel as parameters
    expect(params).toEqual({
      start: '2022-02-17T00:00:00.000Z',
      end: '2022-02-24T00:00:00.000Z',
      t0: '\\brussia',
      t1: '\\bukraine',
    });
  });
});

describe('row mapping', () => {
  it('parses GDELT dates and entities into an article with the shared id scheme', () => {
    expect(gdeltDate(20220224043000)?.toISOString()).toBe('2022-02-24T04:30:00.000Z');
    expect(gdeltDate('2022')).toBeNull();
    expect(decodeEntities('Q&amp;A &#39;now&#39; &#x27;x&#x27;')).toBe("Q&A 'now' 'x'");
    const a = rowToArticle(ROW, 'world')!;
    expect(a).toMatchObject({
      headline: 'Russia launches invasion of Ukraine & Kyiv hit by missiles',
      source: 'reuters.com',
      url: 'https://www.reuters.com/world/europe/russia-ukraine-2022-02-24/',
      sentiment: 'negative',
      tone: -6.2,
    });
    expect(a.id).toMatch(/^[0-9a-f]{16}$/);
    expect(rowToArticle({ ...ROW, title: null })).toBeNull();
  });
});

describe('GdeltBigQueryService.backfillStory', () => {
  it('is unavailable without credentials and never builds a client', async () => {
    const svc = new GdeltBigQueryService(usage(), {});
    expect(svc.enabled).toBe(false);
    await expect(svc.backfillStory('Russia Ukraine', new Date())).resolves.toMatchObject({ status: 'unavailable' });
  });

  it('dry-runs each slice, runs it with a byte cap, and counts the bytes', async () => {
    const u = usage();
    const { client, createQueryJob, query } = fakeClient(2 * GB);
    const svc = new GdeltBigQueryService(u, { BQ_MAX_SLICES: '3' }, client);
    const res = await svc.backfillStory('Russia Ukraine', new Date('2022-03-01T00:00:00Z'));
    expect(res.status).toBe('done');
    expect(res.articles).toHaveLength(1); // same row in every slice → deduped
    expect(createQueryJob).toHaveBeenCalledTimes(3);
    expect(createQueryJob.mock.calls[0][0]).toMatchObject({ dryRun: true });
    expect(query.mock.calls[0][0]).toMatchObject({ maximumBytesBilled: String(20 * GB) });
    expect(res.bytes).toBe(6 * GB);
    expect(u.add).toHaveBeenCalledWith(BQ_USAGE_ID, expect.any(String), 2 * GB);
  });

  it('skips slices that would scan more than the per-query cap', async () => {
    const { client, query } = fakeClient(25 * GB);
    const res = await new GdeltBigQueryService(usage(), { BQ_MAX_SLICES: '2' }, client).backfillStory('Russia Ukraine', new Date());
    expect(query).not.toHaveBeenCalled();
    expect(res.notes[0]).toMatch(/skipped, would scan 25\.0 GB/);
  });

  it('stops when the monthly budget would be exceeded', async () => {
    const { client, query } = fakeClient(10 * GB);
    const svc = new GdeltBigQueryService(usage(895 * GB), { BQ_MAX_SLICES: '4' }, client);
    const res = await svc.backfillStory('Russia Ukraine', new Date());
    expect(query).not.toHaveBeenCalled();
    expect(res.notes[0]).toMatch(/monthly budget reached/);
  });
});

describe('StoryBackfillService', () => {
  function setup(enabled = true, backfilledAt: Date | null = null) {
    const store = {
      getBackfilledAt: vi.fn(async () => backfilledAt),
      markBackfilled: vi.fn(async () => undefined),
      saveStory: vi.fn(async () => []),
    };
    const article = rowToArticle(ROW)!;
    const bigQuery = {
      enabled,
      backfillStory: vi.fn(async () => ({ status: 'done', articles: [article], bytes: 1, notes: [] })),
    };
    return { svc: new StoryBackfillService(store as never, bigQuery as never), store, bigQuery };
  }

  it('runs once in the background, saves to the story, then reports done', async () => {
    const { svc, store, bigQuery } = setup();
    const onDone = vi.fn();
    const first = await svc.ensure('k|', 'Russia Ukraine', undefined, new Date('2022-03-01'), onDone);
    expect(first.state).toBe('pending');
    expect((await svc.ensure('k|', 'Russia Ukraine', undefined, undefined)).state).toBe('pending');
    await first.job;
    expect(bigQuery.backfillStory).toHaveBeenCalledTimes(1);
    expect(bigQuery.backfillStory).toHaveBeenCalledWith('Russia Ukraine', new Date('2022-03-01'), undefined);
    expect(store.saveStory).toHaveBeenCalledWith('k|', 'Russia Ukraine', undefined, [expect.objectContaining({ source: 'reuters.com' })]);
    expect(store.markBackfilled).toHaveBeenCalledWith('k|');
    expect(onDone).toHaveBeenCalled();
    expect((await svc.ensure('k|', 'Russia Ukraine', undefined, undefined)).state).toBe('done');
  });

  it('does not rescan a story backfilled in the last 30 days (survives restarts via the store)', async () => {
    const { svc, bigQuery } = setup(true, new Date(Date.now() - 24 * 3600_000));
    expect((await svc.ensure('k|', 'q', undefined, undefined)).state).toBe('done');
    expect(bigQuery.backfillStory).not.toHaveBeenCalled();
  });

  it('is unavailable when BigQuery is not configured', async () => {
    const { svc, store } = setup(false);
    expect((await svc.ensure('k|', 'q', undefined, undefined)).state).toBe('unavailable');
    expect(store.getBackfilledAt).not.toHaveBeenCalled();
  });
});
