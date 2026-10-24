import { ArticleRecord } from '../store/types';

const EMOJI: Record<string, string> = {
  tech: '💻',
  world: '🌍',
  finance: '📈',
  science: '🔬',
  politics: '🏛️',
  climate: '🌿',
  health: '🩺',
  culture: '🎭',
  sports: '🏅',
  opinion: '✎',
};

export function serializeArticle(a: ArticleRecord) {
  const body = a.body || a.excerpt;
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return {
    id: a.id,
    title: a.headline,
    headline: a.headline,
    excerpt: a.excerpt,
    body,
    publishedAt: a.publishedAt.toISOString(),
    source: a.source,
    category: a.category,
    isBreaking: a.importance === 'critical' || a.importance === 'high',
    imageUrl: a.imageUrl ?? '',
    thumbnailEmoji: EMOJI[a.category] ?? '📰',
    tags: [a.category, a.source],
    readTimeMinutes: Math.max(1, Math.round(words / 200)),
    url: a.url,
    sentiment: a.sentiment,
    bias: a.bias,
    importance: a.importance,
    storyClusterId: a.storyClusterId,
  };
}
