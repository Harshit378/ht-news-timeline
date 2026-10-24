import axios from 'axios';
import type { ArticleCategory, FeedArticle } from './article';
import type { LiveEventTimeline } from './live-events';

/**
 * Typed client for the NestJS API (apps/api), shared by the web app and the Expo app (ADR-001).
 * Response shapes mirror apps/api/src/rest/serialize.ts. Each app creates the axios instance with its own
 * base URL (NEXT_PUBLIC_API_URL / EXPO_PUBLIC_API_URL), which must end in /api.
 */

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

export interface SourceComparisonData {
  commonThemes: string[];
  differences: { source: string; point: string }[];
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

/** HTTP status of a failed request, or undefined when there was no response. */
export function httpStatusOf(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}

/** Live events socket (ADR-005): http://host:4000/api → ws://host:4000/ws/events, unless overridden. */
export function deriveWsUrl(apiBase: string, override?: string): string {
  if (override) return override;
  const origin = apiBase.replace(/\/+$/, '').replace(/\/api$/, '');
  return `${origin.replace(/^http/, 'ws')}/ws/events`;
}

/**
 * The two calls the client needs from an axios instance. Structural, so each app can pass its own axios
 * copy (the Expo app and the repo root resolve different axios versions).
 */
export interface HttpClient {
  get<T>(url: string, config?: { params?: Record<string, unknown>; signal?: AbortSignal; timeout?: number }): Promise<{ data: T }>;
  put(url: string, body?: unknown): Promise<unknown>;
}

export function createNewsApi(api: HttpClient) {
  return {
    async getFeed(page = 1, category?: ArticleCategory, region?: string): Promise<Paged<FeedArticle>> {
      const { data } = await api.get<Paged<FeedArticle>>('/feed', { params: { page, category, region } });
      return data;
    },

    async getArticle(id: string): Promise<FeedArticle> {
      const { data } = await api.get<FeedArticle>(`/articles/${encodeURIComponent(id)}`);
      return data;
    },

    async searchArticles(q: string): Promise<FeedArticle[]> {
      const { data } = await api.get<{ query: string; results: FeedArticle[] }>('/search', { params: { q } });
      return data.results;
    },

    /** Full story timeline for a query, oldest event first. */
    async getStoryTimeline(q: string, category?: string, signal?: AbortSignal): Promise<StoryTimelineResponse> {
      const { data } = await api.get<StoryTimelineResponse>('/timeline', {
        params: { q, category },
        signal,
        // The API answers within its 15s story deadline (partial + `degraded` if providers are slow).
        timeout: 30_000,
      });
      return data;
    },

    /** AI brief for a story timeline; poll while `status` is 'pending'. */
    async getStoryBrief(q: string, category?: string, signal?: AbortSignal): Promise<StoryBriefResponse> {
      const { data } = await api.get<StoryBriefResponse>('/timeline/brief', { params: { q, category }, signal });
      return data;
    },

    async getTrending(): Promise<TrendingTopic[]> {
      const { data } = await api.get<{ topics: TrendingTopic[] } | TrendingTopic[]>('/trending');
      return Array.isArray(data) ? data : data.topics;
    },

    async getTopics(): Promise<TopicCount[]> {
      const { data } = await api.get<{ topics: TopicCount[] }>('/topics');
      return data.topics;
    },

    async getLiveEvents(): Promise<LiveEventTimeline[]> {
      const { data } = await api.get<LiveEventTimeline[]>('/events');
      return data;
    },

    /** Replaces this device's server-side bookmark set (ADR-006). */
    async putBookmarks(userId: string, articleIds: string[]): Promise<void> {
      await api.put('/bookmarks', { userId, articleIds });
    },
  };
}

export type NewsApi = ReturnType<typeof createNewsApi>;
