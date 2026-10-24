import type { CSSProperties } from 'react';
import { CORE_TOPICS, type ArticleCategory } from '@/app/types/article';

const TINT = Object.fromEntries(CORE_TOPICS.map((t) => [t.slug, t.tint])) as Record<
  ArticleCategory,
  string
>;

/** Inline style for a category tag chip, derived from CORE_TOPICS tints (works in both themes). */
export function categoryTagStyle(category: string): CSSProperties {
  const tint = TINT[category as ArticleCategory] ?? '#94a3b8';
  return { color: tint, backgroundColor: `${tint}1f`, borderColor: `${tint}40` };
}

export function categoryName(category: string): string {
  return CORE_TOPICS.find((t) => t.slug === category)?.name ?? category;
}
