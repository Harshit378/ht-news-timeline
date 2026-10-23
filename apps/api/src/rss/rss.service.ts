import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import { NewsStore } from '../store/news.store';
import { RssFeedRecord } from '../store/types';

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

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
      lastChecked: new Date(),
      itemCount: parsed.items.length,
      addedAt: new Date(),
    };
    return this.store.saveFeed(feed);
  }

  async remove(id: string) {
    if (!this.store.getFeed(id)) throw new NotFoundException();
    await this.store.removeFeed(id);
    return { ok: true, id };
  }

  async toggle(id: string, isActive: boolean) {
    const feed = this.store.getFeed(id);
    if (!feed) throw new NotFoundException();
    feed.isActive = isActive;
    return this.store.saveFeed(feed);
  }

  async parse(rawUrl: string) {
    const url = this.sanitizeUrl(rawUrl);
    const { data, headers } = await axios.get<string>(url, {
      timeout: 12000,
      responseType: 'text',
      headers: { 'User-Agent': 'NewsTimeline/0.1' },
      maxContentLength: 1_000_000,
    });
    const contentType = String(headers['content-type'] ?? '');
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
    const title = String(rssChannel?.title ?? atom?.title ?? 'Untitled feed');
    const description = String(rssChannel?.description ?? atom?.subtitle ?? '');
    const rawItems = rssChannel?.item ?? atom?.entry ?? [];
    const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).slice(0, 30).map((item, i) => {
      const row = item as Record<string, unknown>;
      // RSS: <link>url</link>; Atom: <link href="url"/> (parsed as an object)
      const link =
        typeof row.link === 'string' ? row.link : (row.link as { '@_href'?: string } | undefined)?.['@_href'];
      return {
        id: String(row.guid ?? row.id ?? `${url}-${i}`),
        title: this.stripTags(String(row.title ?? 'Untitled')),
        description: this.stripTags(String(row.description ?? row.summary ?? '')).slice(0, 400),
        link: String(link ?? url),
        pubDate: String(row.pubDate ?? row.updated ?? new Date().toISOString()),
      };
    });
    return { title, description, items, parseTime: Date.now() };
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

  private stripScripts(xml: string) {
    return xml.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  }

  private stripTags(html: string) {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
