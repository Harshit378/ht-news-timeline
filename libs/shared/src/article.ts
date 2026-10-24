export type ArticleCategory =
  | 'tech'
  | 'world'
  | 'finance'
  | 'science'
  | 'politics'
  | 'climate'
  | 'health'
  | 'culture'
  | 'sports'
  | 'opinion';

export const FILTER_CATEGORIES: { id: ArticleCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tech', label: 'Tech' },
  { id: 'world', label: 'World' },
  { id: 'finance', label: 'Finance' },
  { id: 'science', label: 'Science' },
  { id: 'politics', label: 'Politics' },
  { id: 'climate', label: 'Climate' },
  { id: 'health', label: 'Health' },
  { id: 'culture', label: 'Culture' },
  { id: 'sports', label: 'Sports' },
  { id: 'opinion', label: 'Opinion' },
];

export const CORE_TOPICS: {
  slug: ArticleCategory;
  name: string;
  emoji: string;
  tint: string;
}[] = [
  { slug: 'tech', name: 'Technology', emoji: '💻', tint: '#3b82f6' },
  { slug: 'world', name: 'World News', emoji: '🌍', tint: '#22c55e' },
  { slug: 'finance', name: 'Finance', emoji: '📈', tint: '#c9a84c' },
  { slug: 'science', name: 'Science', emoji: '🔬', tint: '#a855f7' },
  { slug: 'politics', name: 'Politics', emoji: '🏛️', tint: '#f97316' },
  { slug: 'climate', name: 'Climate', emoji: '🌿', tint: '#14b8a6' },
  { slug: 'health', name: 'Health', emoji: '🩺', tint: '#ef4444' },
  { slug: 'culture', name: 'Culture', emoji: '🎭', tint: '#ec4899' },
  { slug: 'sports', name: 'Sports', emoji: '🏅', tint: '#84cc16' },
  { slug: 'opinion', name: 'Opinion', emoji: '✎', tint: '#94a3b8' },
];

export const CATEGORY_EMOJI: Record<ArticleCategory, string> = Object.fromEntries(
  CORE_TOPICS.map((t) => [t.slug, t.emoji])
) as Record<ArticleCategory, string>;

export interface FeedArticle {
  id: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  source: string;
  category: ArticleCategory;
  isBreaking: boolean;
  body: string;
  imageUrl: string;
  thumbnailEmoji: string;
  tags: string[];
  readTimeMinutes: number;
  url?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  bias?: 'left' | 'center' | 'right';
  importance?: 'critical' | 'high' | 'normal' | 'low';
  storyClusterId?: string | null;
  /** "milestone" = a dated event from Wikipedia on a story timeline (ADR-008 step 6). */
  kind?: 'report' | 'milestone';
}

export interface BreakingNewsPayload {
  articleId: string;
  headline: string;
  publishedAt: string;
}

export function isArticleCategory(value: string): value is ArticleCategory {
  return CORE_TOPICS.some((t) => t.slug === value);
}
