'use client';

import { api as rssClient } from '@/app/lib/api-client';
import { RSSFeed, RSSItem, RSSParseResult } from './types';

export async function addRSSFeed(url: string, category: string): Promise<RSSFeed> {
  const response = await rssClient.post('/rss/feeds', { url, category });
  return response.data;
}

export async function removeRSSFeed(feedId: string): Promise<void> {
  await rssClient.delete(`/rss/feeds/${feedId}`);
}

export async function listRSSFeeds(): Promise<RSSFeed[]> {
  const response = await rssClient.get('/rss/feeds');
  return response.data;
}

export async function getRSSItems(feedId: string): Promise<RSSItem[]> {
  const response = await rssClient.get(`/rss/feeds/${feedId}/items`);
  return response.data;
}

export async function parseRSSFeed(url: string): Promise<RSSParseResult> {
  const response = await rssClient.post('/rss/parse', { url });
  return response.data;
}

export async function toggleRSSFeed(feedId: string, isActive: boolean): Promise<RSSFeed> {
  const response = await rssClient.patch(`/rss/feeds/${feedId}`, { isActive });
  return response.data;
}

// Local mock data for when API is unavailable
export const mockRSSFeeds: RSSFeed[] = [
  {
    id: 'rss-1',
    title: 'Hacker News',
    url: 'https://news.ycombinator.com/rss',
    description: 'Hacker News RSS feed',
    category: 'tech',
    lastChecked: new Date().toISOString(),
    itemCount: 30,
    isActive: true,
    addedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rss-2',
    title: 'BBC News',
    url: 'https://feeds.bbci.co.uk/news/rss.xml',
    description: 'BBC News RSS feed',
    category: 'world',
    lastChecked: new Date().toISOString(),
    itemCount: 50,
    isActive: true,
    addedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rss-3',
    title: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    description: 'TechCrunch RSS feed',
    category: 'tech',
    lastChecked: new Date().toISOString(),
    itemCount: 25,
    isActive: false,
    addedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export function generateMockRSSItems(feedId: string, count: number = 10): RSSItem[] {
  const feedNames: Record<string, string> = {
    'rss-1': 'Hacker News',
    'rss-2': 'BBC News',
    'rss-3': 'TechCrunch',
  };

  const items: RSSItem[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: `rss-item-${feedId}-${i}`,
      feedId,
      title: `Article ${i + 1} from ${feedNames[feedId] || 'RSS Feed'}`,
      description: `This is a sample article description for article number ${i + 1}. It contains important information about the topic.`,
      link: `https://example.com/article-${i}`,
      pubDate: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
      author: 'RSS Author',
      categories: ['news', 'tech'],
    });
  }
  return items;
}
