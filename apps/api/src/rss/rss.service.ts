import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { randomUUID } from 'crypto';
import { lookup } from 'dns/promises';
import { BlockList, isIP } from 'net';
import { XMLParser } from 'fast-xml-parser';
import { NewsStore } from '../store/news.store';
import { RssFeedRecord } from '../store/types';

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true, htmlEntities: true });

const MAX_ITEMS = 50;
const MAX_REDIRECTS = 3;

export interface ParsedFeedItem {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
  imageUrl: string | null;
}

export interface ParsedFeed {
  notModified: false;
  title: string;
  description: string;
  items: ParsedFeedItem[];
  etag: string | null;
  lastModified: string | null;
  parseTime: number;
}

export interface FeedCacheHeaders {
  etag?: string | null;
  lastModified?: string | null;
}

/** Feeds the server polls must not reach loopback, private, link-local or metadata addresses. */
const blockedAddresses = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedAddresses.addSubnet(net, prefix, 'ipv4');
}
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
] as const) {
  blockedAddresses.addSubnet(net, prefix, 'ipv6');
}

export function isBlockedAddress(address: string) {
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return blockedAddresses.check(mapped[1], 'ipv4');
  return blockedAddresses.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');
}

/** Element text whether the parser produced a string, a number, `{ '#text': … }` or a list. */
function text(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === 'object') return text((value as Record<string, unknown>)['#text']);
  return '';
}

function asList(value: unknown): Record<string, unknown>[] {
  if (value == null) return [];
  return (Array.isArray(value) ? value : [value]).filter(
    (v): v is Record<string, unknown> => typeof v === 'object' && v !== null,
  );
}

/** RSS: <link>url</link>; Atom: <link href="url"/>, possibly several (prefer rel="alternate"). */
function linkOf(row: Record<string, unknown>): string | undefined {
  if (typeof row.link === 'string') return row.link;
  const links = asList(row.link);
  const pick = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
  return pick?.['@_href'] as string | undefined;
}

/** Longest excerpt we keep per item: about one paragraph, enough to read without leaving the app. */
export const MAX_EXCERPT_CHARS = 1000;

/** Cuts at a sentence end (or word boundary) near `max` and never mid-word. */
export function clipText(text: string, max = MAX_EXCERPT_CHARS): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const sentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  if (sentence > max * 0.5) return head.slice(0, sentence + 1);
  return `${head.slice(0, head.lastIndexOf(' ')).replace(/[\s,;:–—-]+$/, '')}…`;
}

/**
 * The richest text the feed gives for an item: description/summary or content:encoded,
 * whichever is longer, with publisher boilerplate removed. Headline, excerpt and link only —
 * never the full body (ADR-008).
 */
export function bestSummary(row: Record<string, unknown>, strip: (html: string) => string): string {
  const candidates = [text(row.description), text(row.summary), text(row['content:encoded']), text(row.content)]
    .map((html) => strip(html).replace(/\s*Continue reading\.{0,3}\s*$/i, '').trim())
    .filter(Boolean);
  const longest = candidates.sort((x, y) => y.length - x.length)[0] ?? '';
  return clipText(longest);
}

/** Largest media:content image, then media:thumbnail, image enclosure, or the first <img> in content. */
export function imageOf(row: Record<string, unknown>): string | null {
  const candidates: { url: string; width: number }[] = [];
  for (const m of asList(row['media:content'])) {
    const type = String(m['@_type'] ?? m['@_medium'] ?? 'image');
    if (typeof m['@_url'] === 'string' && /image/.test(type)) {
      candidates.push({ url: m['@_url'], width: Number(m['@_width']) || 0 });
    }
    for (const t of asList(m['media:thumbnail'])) {
      if (typeof t['@_url'] === 'string') candidates.push({ url: t['@_url'], width: Number(t['@_width']) || 0 });
    }
  }
  for (const t of asList(row['media:thumbnail'])) {
    if (typeof t['@_url'] === 'string') candidates.push({ url: t['@_url'], width: Number(t['@_width']) || 0 });
  }
  for (const e of asList(row.enclosure)) {
    if (typeof e['@_url'] === 'string' && /^image\//.test(String(e['@_type'] ?? ''))) {
      candidates.push({ url: e['@_url'], width: 0 });
    }
  }
  if (candidates.length) return candidates.sort((a, b) => b.width - a.width)[0].url;
  const html = text(row['content:encoded']) || text(row.content) || text(row.description);
  return html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null;
}

@Injectable()
export class RssService {
  constructor(private readonly store: NewsStore) {}

  list() {
    return this.store.listFeeds();
  }

  async add(rawUrl: string, category: string) {
    const url = this.sanitizeUrl(rawUrl);
    const existing = this.store.findFeedByUrl(url);
    if (existing) return existing;
    const parsed = await this.parse(url);
    const feed: RssFeedRecord = {
      id: randomUUID(),
      title: parsed.title,
      url,
      description: parsed.description,
      category,
      isActive: true,
      origin: 'user',
      source: null,
      etag: parsed.etag,
      lastModified: parsed.lastModified,
      lastChecked: new Date(),
      lastItemAt: null,
      lastError: null,
      failureCount: 0,
      itemCount: parsed.items.length,
      addedAt: new Date(),
    };
    return this.store.saveFeed(feed);
  }

  async remove(id: string) {
    const feed = this.store.getFeed(id);
    if (!feed) throw new NotFoundException();
    // Curated feeds are re-seeded on boot; switching them off is what makes removal stick.
    if (feed.origin === 'curated') {
      await this.store.saveFeed({ ...feed, isActive: false });
      return { ok: true, id, disabled: true };
    }
    await this.store.removeFeed(id);
    return { ok: true, id };
  }

  async toggle(id: string, isActive: boolean) {
    const feed = this.store.getFeed(id);
    if (!feed) throw new NotFoundException();
    feed.isActive = isActive;
    return this.store.saveFeed(feed);
  }

  async parse(rawUrl: string): Promise<ParsedFeed> {
    const result = await this.fetchFeed(rawUrl);
    if (result.notModified) throw new BadRequestException('Feed returned 304 without a cached copy');
    return result;
  }

  /** Conditional GET: pass the feed's stored ETag / Last-Modified to get `notModified` on a 304. */
  async fetchFeed(rawUrl: string, cache: FeedCacheHeaders = {}): Promise<ParsedFeed | { notModified: true }> {
    let url = this.sanitizeUrl(rawUrl);
    let response: AxiosResponse<string>;
    for (let hop = 0; ; hop += 1) {
      await this.assertPublicHost(url);
      response = await axios.get<string>(url, {
        timeout: 12000,
        responseType: 'text',
        headers: {
          'User-Agent': 'NewsTimeline/0.1',
          ...(cache.etag && { 'If-None-Match': cache.etag }),
          ...(cache.lastModified && { 'If-Modified-Since': cache.lastModified }),
        },
        maxContentLength: 2_000_000,
        // Redirects are followed by hand so every hop passes the private-address check.
        maxRedirects: 0,
        validateStatus: (s) => (s >= 200 && s < 400),
      });
      const location = response.headers.location as string | undefined;
      if (response.status < 300 || response.status === 304 || !location) break;
      if (hop >= MAX_REDIRECTS) throw new BadRequestException('Too many redirects');
      url = this.sanitizeUrl(new URL(location, url).toString());
    }
    if (response.status === 304) return { notModified: true };

    const data = response.data;
    const contentType = String(response.headers['content-type'] ?? '');
    if (contentType && !/xml|rss|atom|text/i.test(contentType) && !data.trim().startsWith('<')) {
      throw new BadRequestException('URL did not return XML or Atom');
    }
    let xml: Record<string, unknown>;
    try {
      xml = parser.parse(this.stripScripts(data));
    } catch {
      throw new BadRequestException('Invalid XML');
    }
    const rssChannel = (xml.rss as { channel?: Record<string, unknown> } | undefined)?.channel;
    const atom = xml.feed as Record<string, unknown> | undefined;
    if (!rssChannel && !atom) {
      throw new BadRequestException('Not a valid RSS or Atom feed');
    }
    const title = this.stripTags(text(rssChannel?.title ?? atom?.title)) || 'Untitled feed';
    const description = this.stripTags(text(rssChannel?.description ?? atom?.subtitle));
    const items = asList(rssChannel?.item ?? atom?.entry)
      .slice(0, MAX_ITEMS)
      .map((row, i) => {
        const link = linkOf(row);
        return {
          id: text(row.guid) || text(row.id) || link || `${url}-${i}`,
          title: this.stripTags(text(row.title)) || 'Untitled',
          description: bestSummary(row, (html) => this.stripTags(html)),
          link: link ?? url,
          pubDate: text(row.pubDate) || text(row.published) || text(row.updated) || text(row['dc:date']),
          imageUrl: imageOf(row),
        };
      });
    return {
      notModified: false,
      title,
      description,
      items,
      etag: (response.headers.etag as string | undefined) ?? null,
      lastModified: (response.headers['last-modified'] as string | undefined) ?? null,
      parseTime: Date.now(),
    };
  }

  private sanitizeUrl(raw: string) {
    let parsed: URL;
    try {
      parsed = new URL(raw.trim());
    } catch {
      throw new BadRequestException('Invalid URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Only http(s) feed URLs are allowed');
    }
    parsed.hash = '';
    return parsed.toString();
  }

  private async assertPublicHost(url: string) {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
    let addresses: { address: string }[];
    try {
      addresses = await lookup(host, { all: true });
    } catch {
      throw new BadRequestException(`Cannot resolve ${host}`);
    }
    if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
      throw new BadRequestException('Feed URL must point to a public host');
    }
  }

  private stripScripts(xml: string) {
    return xml.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  }

  private stripTags(html: string) {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
