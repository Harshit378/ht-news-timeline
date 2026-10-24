import { describe, expect, it } from 'vitest';
import { buildComparison } from '../app/features/source-comparison/comparison';
import type { FeedArticle } from '../app/types/article';

function art(id: string, source: string, iso: string): FeedArticle {
  return {
    id, title: `Title ${id}`, excerpt: '', publishedAt: iso, source, category: 'sports', isBreaking: false,
    body: '', imageUrl: '', thumbnailEmoji: '', tags: [], readTimeMinutes: 1,
  };
}

const items = [
  art('a1', 'ESPN', '2026-10-24T10:00:00Z'),
  art('a2', 'ESPN', '2026-10-24T12:00:00Z'),
  art('a3', 'ESPN', '2026-10-24T08:00:00Z'),
  art('b1', 'BBC Sport', '2026-10-24T11:00:00Z'),
  art('c1', 'Times of India', '2026-10-24T09:00:00Z'),
];

describe('buildComparison', () => {
  it('groups reports by source, newest first, and attaches differences to the right outlet', () => {
    const out = buildComparison(items, {
      commonThemes: ['Game 7 result'],
      differences: [{ source: 'times of india', point: 'Focuses on the Indian-origin pitcher.' }],
    });
    expect(out?.commonThemes).toEqual(['Game 7 result']);
    // Outlets the model singled out first, then by report count.
    expect(out?.sources.map((s) => s.source)).toEqual(['Times of India', 'ESPN', 'BBC Sport']);
    const espn = out!.sources[1];
    expect(espn).toMatchObject({ reportCount: 3, latest: { id: 'a2' }, differences: [] });
    expect(espn.earlier.map((e) => e.id)).toEqual(['a1', 'a3']);
    expect(out!.sources[0].differences).toEqual(['Focuses on the Indian-origin pitcher.']);
  });

  it('is null with fewer than 2 sources, no AI data, or an empty comparison', () => {
    expect(buildComparison(items.filter((a) => a.source === 'ESPN'), { commonThemes: ['x'], differences: [] })).toBeNull();
    expect(buildComparison(items, null)).toBeNull();
    expect(buildComparison(items, { commonThemes: [], differences: [] })).toBeNull();
    expect(buildComparison(items, { commonThemes: [], differences: [{ source: 'Unknown', point: 'not in the story' }] })).toBeNull();
  });
});
