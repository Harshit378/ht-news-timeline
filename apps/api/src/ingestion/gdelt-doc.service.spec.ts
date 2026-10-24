import 'reflect-metadata';
import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { GdeltCoolingDownError, GdeltDocService } from './gdelt-doc.service';

function rateLimited() {
  const headers = new AxiosHeaders();
  return new AxiosError('Request failed with status code 429', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 429, statusText: 'Too Many Requests', headers, config: { headers }, data: '',
  });
}

function withHttp(get: ReturnType<typeof vi.fn>) {
  const svc = new GdeltDocService();
  (svc as unknown as { http: { get: typeof get } }).http = { get };
  return svc;
}

describe('GdeltDocService cooldown', () => {
  it('opens a cooldown on 429 and fails fast without further requests', async () => {
    const get = vi.fn(async () => Promise.reject(rateLimited()));
    const svc = withHttp(get);

    await expect(svc.searchRecent('world series')).rejects.toThrow('429');
    expect(get).toHaveBeenCalledTimes(1); // 429s are not retried
    expect(svc.status().state).toBe('cooldown');

    await expect(svc.searchRecent('world series')).rejects.toBeInstanceOf(GdeltCoolingDownError);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('searches a one-week window', async () => {
    const get = vi.fn(async () => ({
      data: { articles: [{ url: 'https://ex.test/a', title: 'A', seendate: '20261024T100000Z', domain: 'ex.test' }] },
    }));
    const svc = withHttp(get);
    const items = await svc.searchRecent('World Series', 'sports');
    expect(items.map((i) => i.category)).toEqual(['sports']);
    expect(get.mock.calls[0][1].params).toMatchObject({ timespan: '1w', sort: 'HybridRel' });
    expect(svc.status()).toMatchObject({ state: 'ok', lastError: null });
  });
});
