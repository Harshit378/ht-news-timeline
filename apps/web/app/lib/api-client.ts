import axios from 'axios';
import type { ArticleCategory, FeedArticle } from '@/app/types/article';

/**
 * Typed client for the NestJS API (apps/api). The response shapes mirror
 * apps/api/src/rest/serialize.ts, which already emits FeedArticle.
 *
 * NEXT_PUBLIC_API_URL must be an absolute URL in native builds
 * (e.g. http://192.168.1.20:4000/api) since the app is served from capacitor://localhost.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
});

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface StoryTimelineResponse {
  query: string;
  /** Global sources unreachable — items are partial. */
  degraded?: boolean;
  firstSeen: string | null;
  lastSeen: string | null;
  items: FeedArticle[];
}

export interface TrendingTopic {
  rank: number;
  topic: string;
  count: number;
}

export interface TopicCount {
  slug: ArticleCategory;
  name: string;
  count: number;
}

/** True when the request never got an HTTP response (no network / server down) — not merely slow. */
export function isOfflineError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response && err.code !== 'ECONNABORTED' && err.code !== 'ETIMEDOUT';
}

export async function getFeed(page = 1, category?: ArticleCategory): Promise<Paged<FeedArticle>> {
  const { data } = await api.get<Paged<FeedArticle>>('/feed', { params: { page, category } });
  return data;
}

export async function getArticle(id: string): Promise<FeedArticle> {
  const { data } = await api.get<FeedArticle>(`/articles/${encodeURIComponent(id)}`);
  return data;
}

export async function searchArticles(q: string): Promise<FeedArticle[]> {
  const { data } = await api.get<{ query: string; results: FeedArticle[] }>('/search', {
    params: { q },
  });
  return data.results;
}

/** Full story timeline for a query, oldest event first. */
export async function getStoryTimeline(
  q: string,
  category?: string,
  signal?: AbortSignal
): Promise<StoryTimelineResponse> {
  const { data } = await api.get<StoryTimelineResponse>('/timeline', {
    params: { q, category },
    signal,
    // The API answers within its 50s story deadline (partial + `degraded` if GDELT is slow).
    timeout: 60_000,
  });
  return data;
}

export async function getTrending(): Promise<TrendingTopic[]> {
  const { data } = await api.get<{ topics: TrendingTopic[] } | TrendingTopic[]>('/trending');
  return Array.isArray(data) ? data : data.topics;
}

export async function getTopics(): Promise<TopicCount[]> {
  const { data } = await api.get<{ topics: TopicCount[] }>('/topics');
  return data.topics;
}
