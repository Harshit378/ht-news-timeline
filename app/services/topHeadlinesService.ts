'use client';

import { TimelineEvent } from '@/app/types/timeline';
import { newsOrgClient } from './newsOrgClient';

export async function fetchTopHeadlines(country = 'us'): Promise<TimelineEvent[]> {
  const response = await newsOrgClient.get('/top-headlines', {
    params: {
      country,
      pageSize: 30,
      apiKey: process.env.NEXT_PUBLIC_NEWSORG_API_KEY,
    },
  });

  return mapArticlesToTimeline(response.data.articles || []);
}

function mapArticlesToTimeline(articles: any[]): TimelineEvent[] {
  return articles.map((article) => ({
    id: article.url || `${article.title}-${article.publishedAt}`,
    title: article.title || 'Untitled story',
    description: article.description || article.content || 'No description available.',
    date: article.publishedAt || new Date().toISOString(),
    source: article.source?.name || 'NewsOrg',
    content: article.content || article.description || 'No content available.',
    imageUrl: article.urlToImage || '',
    tags: [article.source?.name || 'NewsOrg'],
  }));
}
