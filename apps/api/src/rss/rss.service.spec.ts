import 'reflect-metadata';
import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('dns/promises', () => ({
  lookup: vi.fn(async (host: string) => [{ address: host === 'internal.test' ? '10.0.0.5' : '93.184.216.34' }]),
}));

import { RssService, bestSummary, clipText, imageOf, isBlockedAddress } from './rss.service';

const RSS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel><title>Example &amp; Co</title><description>News</description>
  <item>
    <title><![CDATA[Brewers win <b>Game 1</b>]]></title>
    <link>https://ex.test/a?at_medium=RSS</link>
    <guid isPermaLink="false">US-EN-1</guid>
    <description>&lt;p&gt;Takeaways from the opener&lt;/p&gt;</description>
    <pubDate>Sat, 24 Oct 2026 10:23:25 EST</pubDate>
    <media:content url="https://img.test/small.jpg" width="140" medium="image"/>
    <media:content url="https://img.test/large.jpg" width="460" medium="image"/>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title type="html">Atom Feed</title>
  <entry>
    <title type="html">Apple event preview</title>
    <link rel="alternate" type="text/html" href="https://atom.test/post"/>
    <id>https://atom.test/?p=1</id>
    <published>2026-10-24T10:15:00-04:00</published>
    <summary type="html">What to expect</summary>
    <content type="html">&lt;img src="https://img.test/inline.jpg"&gt;</content>
  </entry>
</feed>`;

function respond(data: string, status = 200, headers: Record<string, string> = {}) {
  return { data, status, headers: { 'content-type': 'application/rss+xml', ...headers } };
}

afterEach(() => vi.restoreAllMocks());

describe('RssService.fetchFeed', () => {
  const svc = new RssService({} as never);

  it('parses RSS 2.0 with CDATA, object guids and the largest media image', async () => {
    vi.spyOn(axios, 'get').mockResolvedValueOnce(respond(RSS, 200, { etag: '"v1"' }));
    const res = await svc.fetchFeed('https://ex.test/feed');
    if (res.notModified) throw new Error('expected a parsed feed');
    expect(res.title).toBe('Example & Co');
    expect(res.etag).toBe('"v1"');
    expect(res.items[0]).toMatchObject({
      id: 'US-EN-1',
      title: 'Brewers win Game 1',
      description: 'Takeaways from the opener',
      link: 'https://ex.test/a?at_medium=RSS',
      imageUrl: 'https://img.test/large.jpg',
    });
  });

  it('parses Atom alternate links and falls back to inline images', async () => {
    vi.spyOn(axios, 'get').mockResolvedValueOnce(respond(ATOM));
    const res = await svc.fetchFeed('https://atom.test/feed');
    if (res.notModified) throw new Error('expected a parsed feed');
    expect(res.items[0]).toMatchObject({
      title: 'Apple event preview',
      link: 'https://atom.test/post',
      pubDate: '2026-10-24T10:15:00-04:00',
      imageUrl: 'https://img.test/inline.jpg',
    });
  });

  it('sends cache validators and reports 304 as not modified', async () => {
    const get = vi.spyOn(axios, 'get').mockResolvedValueOnce(respond('', 304));
    const res = await svc.fetchFeed('https://ex.test/feed', { etag: '"v1"', lastModified: 'Sat, 24 Oct 2026' });
    expect(res.notModified).toBe(true);
    expect(get.mock.calls[0][1]?.headers).toMatchObject({ 'If-None-Match': '"v1"', 'If-Modified-Since': 'Sat, 24 Oct 2026' });
  });

  it('rejects private hosts, including via redirects', async () => {
    await expect(svc.fetchFeed('http://internal.test/feed')).rejects.toThrow('public host');
    vi.spyOn(axios, 'get').mockResolvedValueOnce(respond('', 302, { location: 'http://internal.test/x' }));
    await expect(svc.fetchFeed('https://ex.test/feed')).rejects.toThrow('public host');
  });
});

describe('isBlockedAddress', () => {
  it('blocks loopback, private, link-local/metadata and mapped addresses', () => {
    for (const a of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.20', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1']) {
      expect(isBlockedAddress(a), a).toBe(true);
    }
    expect(isBlockedAddress('93.184.216.34')).toBe(false);
    expect(isBlockedAddress('2606:4700::1111')).toBe(false);
  });
});

describe('imageOf', () => {
  it('reads media:thumbnail and image enclosures', () => {
    expect(imageOf({ 'media:thumbnail': { '@_url': 'https://img.test/t.jpg' } })).toBe('https://img.test/t.jpg');
    expect(imageOf({ enclosure: { '@_url': 'https://img.test/e.png', '@_type': 'image/png' } })).toBe('https://img.test/e.png');
    expect(imageOf({ enclosure: { '@_url': 'https://a.test/x.mp3', '@_type': 'audio/mpeg' } })).toBeNull();
  });
});

describe('RssService.remove', () => {
  it('disables curated feeds instead of deleting them, deletes user feeds', async () => {
    const feeds: Record<string, { id: string; origin: string; isActive: boolean }> = {
      c: { id: 'c', origin: 'curated', isActive: true },
      u: { id: 'u', origin: 'user', isActive: true },
    };
    const store = {
      getFeed: (id: string) => feeds[id],
      saveFeed: vi.fn(async (f: (typeof feeds)[string]) => (feeds[f.id] = f)),
      removeFeed: vi.fn(async (id: string) => delete feeds[id]),
    };
    const svc = new RssService(store as never);
    expect(await svc.remove('c')).toEqual({ ok: true, id: 'c', disabled: true });
    expect(feeds.c.isActive).toBe(false);
    await svc.remove('u');
    expect(store.removeFeed).toHaveBeenCalledWith('u');
  });
});

describe('bestSummary / clipText', () => {
  const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  it('prefers the longer of description and content:encoded and drops boilerplate', () => {
    const row = {
      description: 'Short teaser.',
      'content:encoded': '<p>First paragraph of the story.</p><p>Second paragraph with more detail.</p>',
    };
    expect(bestSummary(row, strip)).toBe('First paragraph of the story. Second paragraph with more detail.');
    expect(bestSummary({ description: '<p>Lead text.</p><a>Continue reading...</a>' }, strip)).toBe('Lead text.');
  });

  it('clips at a sentence end, otherwise at a word, never mid-word', () => {
    const sentences = 'Alpha beta gamma delta. '.repeat(60).trim();
    const clipped = clipText(sentences, 200);
    expect(clipped.length).toBeLessThanOrEqual(200);
    expect(clipped.endsWith('delta.')).toBe(true);
    const words = clipText('word '.repeat(100).trim(), 50);
    expect(words.endsWith('word…')).toBe(true);
    expect(clipText('short', 50)).toBe('short');
  });
});
