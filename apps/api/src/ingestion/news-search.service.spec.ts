import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { NewsSearchService } from './news-search.service';
import type { NewsProvider } from './providers/news-provider';
import type { ArticleRecord } from '../store/types';

const status = () => ({ id: 'x', state: 'ok' as const, lastSuccessAt: null, lastError: null });
const art = (id: string) => ({ id }) as ArticleRecord;

function provider(id: string, search?: NewsProvider['search']): NewsProvider {
  return { id, search, status };
}

describe('NewsSearchService', () => {
  it('merges providers and flags a failed one as degraded', async () => {
    const svc = new NewsSearchService([
      provider('a', async () => [art('a1')]),
      provider('b', async () => Promise.reject(new Error('429'))),
      provider('feed-only'),
    ]);
    expect(await svc.search('q')).toEqual({ items: [art('a1')], degraded: true });
  });

  it('times out slow providers', async () => {
    const svc = new NewsSearchService([
      provider('fast', async () => [art('f1')]),
      provider('slow', () => new Promise(() => undefined)),
    ]);
    svc.timeoutMs = 10;
    expect(await svc.search('q')).toEqual({ items: [art('f1')], degraded: true });
  });

  it('throws when every provider fails', async () => {
    const svc = new NewsSearchService([provider('a', async () => Promise.reject(new Error('down')))]);
    await expect(svc.search('q')).rejects.toThrow('down');
  });
});
