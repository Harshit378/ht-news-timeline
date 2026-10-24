import type { FeedArticle } from '@/app/types/article';
import type { SourceComparisonData, StoryComparison } from './types';

const MAX_EARLIER = 4;

/**
 * Joins the story's reports (grouped by outlet) with the AI comparison (ADR-004). Outlets the model
 * singled out come first, then by number of reports. Null when there's nothing to compare.
 */
export function buildComparison(
  items: FeedArticle[],
  data: SourceComparisonData | null | undefined,
): StoryComparison | null {
  const bySource = new Map<string, FeedArticle[]>();
  for (const a of items) {
    const list = bySource.get(a.source) ?? [];
    list.push(a);
    bySource.set(a.source, list);
  }
  if (bySource.size < 2 || !data) return null;

  const diffs = new Map<string, string[]>();
  for (const d of data.differences) {
    const key = [...bySource.keys()].find((s) => s.toLowerCase() === d.source.toLowerCase());
    if (key) diffs.set(key, [...(diffs.get(key) ?? []), d.point]);
  }
  if (data.commonThemes.length === 0 && diffs.size === 0) return null;

  const sources = [...bySource.entries()].map(([source, list]) => {
    const newest = [...list].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    const [latest, ...rest] = newest;
    return {
      source,
      reportCount: list.length,
      latest: { id: latest.id, title: latest.title, publishedAt: latest.publishedAt, url: latest.url },
      earlier: rest.slice(0, MAX_EARLIER).map((a) => ({ id: a.id, title: a.title, publishedAt: a.publishedAt })),
      differences: diffs.get(source) ?? [],
    };
  });
  sources.sort(
    (a, b) =>
      Number(b.differences.length > 0) - Number(a.differences.length > 0) ||
      b.reportCount - a.reportCount ||
      a.source.localeCompare(b.source),
  );
  return { commonThemes: data.commonThemes, sources };
}
