import axios from 'axios';
import { createNewsApi, deriveWsUrl } from '@ht/shared/news-api';

export type {
  Paged,
  StoryTimelineResponse,
  StoryBrief,
  SourceComparisonData,
  StoryBriefResponse,
  TrendingTopic,
  TopicCount,
} from '@ht/shared/news-api';
export { isOfflineError, httpStatusOf } from '@ht/shared/news-api';

/**
 * The web app's instance of the shared API client (libs/shared/src/news-api.ts).
 *
 * NEXT_PUBLIC_API_URL must be an absolute URL in native builds
 * (e.g. http://192.168.1.20:4000/api) since the app is served from capacitor://localhost.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
});

const client = createNewsApi(api);

/**
 * Live events socket (ADR-005). NEXT_PUBLIC_WS_URL wins; otherwise derived from the API URL:
 * http://host:4000/api → ws://host:4000/ws/events.
 */
export function wsUrl(apiBase: string = API_BASE_URL, override = process.env.NEXT_PUBLIC_WS_URL): string {
  return deriveWsUrl(apiBase, override);
}

export const BOOKMARKS_URL = `${API_BASE_URL.replace(/\/+$/, '')}/bookmarks`;

export const {
  getFeed,
  getArticle,
  searchArticles,
  getStoryTimeline,
  getStoryBrief,
  getTrending,
  getTopics,
  getLiveEvents,
  putBookmarks,
  createCheckoutSession,
  createPortalSession,
} = client;
