import axios from 'axios';
import type { ArticleCategory, FeedArticle } from '@/app/types/article';
import type { LiveEventTimeline } from '@/app/features/live-events/types';

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
  /** Older history from BigQuery (ADR-008): 'pending' = still being fetched, poll again. */
  backfill?: 'pending' | 'done' | 'unavailable';
  firstSeen: string | null;
  lastSeen: string | null;
  items: FeedArticle[];
}

export interface StoryBrief {
  summary: string;
  keyPoints: string[];
  sentiment: string;
  articleCount: number;
  sourceCount: number;
  generatedAt: string;
  model: string | null;
  /** How the sources' coverage compares; only for stories with ≥ 3 sources (ADR-004). */
  comparison?: SourceComparisonData | null;
}

export interface SourceComparisonData {
  commonThemes: string[];
  differences: { source: string; point: string }[];
}

export interface StoryBriefResponse {
  /** pending = being written in the background; unavailable = no LLM or too little coverage. */
  status: 'ready' | 'pending' | 'unavailable';
  brief?: StoryBrief;
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

/**
 * Live events socket (ADR-005). NEXT_PUBLIC_WS_URL wins; otherwise derived from the API URL:
 * http://host:4000/api → ws://host:4000/ws/events.
 */
export function wsUrl(apiBase: string = API_BASE_URL, override = process.env.NEXT_PUBLIC_WS_URL): string {
  if (override) return override;
  const origin = apiBase.replace(/\/+$/, '').replace(/\/api$/, '');
  return `${origin.replace(/^http/, 'ws')}/ws/events`;
}

export async function getLiveEvents(): Promise<LiveEventTimeline[]> {
  const { data } = await api.get<LiveEventTimeline[]>('/events');
  return data;
}

/** HTTP status of a failed request, or undefined when there was no response. */
export function httpStatusOf(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}

export const BOOKMARKS_URL = `${API_BASE_URL.replace(/\/+$/, '')}/bookmarks`;

/** Replaces this device's server-side bookmark set (ADR-006). */
export async function putBookmarks(userId: string, articleIds: string[]): Promise<void> {
  await api.put('/bookmarks', { userId, articleIds });
}

/** `region` (ADR-009) boosts that country's outlets in the ranking; omit for the global order. */
export async function getFeed(page = 1, category?: ArticleCategory, region?: string): Promise<Paged<FeedArticle>> {
  const { data } = await api.get<Paged<FeedArticle>>('/feed', { params: { page, category, region } });
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
    // The API answers within its 15s story deadline (partial + `degraded` if providers are slow).
    timeout: 30_000,
  });
  return data;
}

/** AI brief for a story timeline; poll while `status` is 'pending'. */
export async function getStoryBrief(q: string, category?: string, signal?: AbortSignal): Promise<StoryBriefResponse> {
  const { data } = await api.get<StoryBriefResponse>('/timeline/brief', { params: { q, category }, signal });
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
