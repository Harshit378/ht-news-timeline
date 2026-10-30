import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { api, API_BASE_URL } from '../app/lib/api-client';
import { getSummaryCached, listTopicSummaries, generateTopicSummary } from '../app/features/ai-summaries/summaryService';
import { addRSSFeed, listRSSFeeds, parseRSSFeed, removeRSSFeed, toggleRSSFeed } from '../app/features/rss-feeds/rssService';

/** Records every request the shared API client makes and answers from `respond`. */
let requests: InternalAxiosRequestConfig[] = [];
let respond: (config: InternalAxiosRequestConfig) => { status: number; data: unknown } = () => ({ status: 200, data: {} });
const original = api.defaults.adapter;

beforeEach(() => {
  requests = [];
  api.defaults.adapter = (async (config) => {
    requests.push(config);
    const { status, data } = respond(config);
    if (status >= 400) {
      const err = Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data }, config });
      throw err;
    }
    return { data, status, statusText: 'OK', headers: {}, config };
  }) as AxiosAdapter;
});
afterEach(() => {
  api.defaults.adapter = original;
  respond = () => ({ status: 200, data: {} });
});

const url = (c: InternalAxiosRequestConfig) => `${c.method?.toUpperCase()} ${c.baseURL}${c.url}`;

describe('summaryService', () => {
  it('calls /api/summaries once, not /api/api/summaries', async () => {
    respond = () => ({ status: 200, data: [{ topicName: 'tech' }] });
    await listTopicSummaries();
    await getSummaryCached('climate & energy');
    await generateTopicSummary({ topicName: 'tech' } as never);
    expect(requests.map(url)).toEqual([
      `GET ${API_BASE_URL}/summaries`,
      `GET ${API_BASE_URL}/summaries/climate%20%26%20energy`,
      `POST ${API_BASE_URL}/summaries/generate`,
    ]);
    expect(requests.every((r) => !`${r.baseURL}${r.url}`.includes('/api/api/'))).toBe(true);
  });

  it('returns null for a topic without a summary instead of throwing', async () => {
    respond = () => ({ status: 404, data: { message: 'Not Found' } });
    await expect(getSummaryCached('nothing')).resolves.toBeNull();
  });
});

describe('rssService', () => {
  it('hits the API routes that exist in rss.controller.ts', async () => {
    respond = (c) => ({ status: 200, data: c.method === 'get' ? [] : { id: 'f1' } });
    await listRSSFeeds();
    await addRSSFeed('https://example.com/feed.xml', 'tech');
    await toggleRSSFeed('f/1', false);
    await removeRSSFeed('f/1');
    await parseRSSFeed('https://example.com/feed.xml');
    expect(requests.map(url)).toEqual([
      `GET ${API_BASE_URL}/rss/feeds`,
      `POST ${API_BASE_URL}/rss/feeds`,
      `PATCH ${API_BASE_URL}/rss/feeds/f%2F1`,
      `DELETE ${API_BASE_URL}/rss/feeds/f%2F1`,
      `POST ${API_BASE_URL}/rss/parse`,
    ]);
    expect(JSON.parse(requests[1].data as string)).toEqual({ url: 'https://example.com/feed.xml', category: 'tech' });
    expect(JSON.parse(requests[2].data as string)).toEqual({ isActive: false });
  });

  it('surfaces API errors to the caller (the settings page shows them)', async () => {
    respond = () => ({ status: 400, data: { message: 'Not a valid RSS or Atom feed' } });
    await expect(addRSSFeed('https://example.com/not-a-feed', 'tech')).rejects.toThrow('HTTP 400');
  });
});
