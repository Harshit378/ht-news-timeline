import { describe, expect, it } from 'vitest';
import { groupByPeriod, pickGranularity } from '../app/lib/timeline-grouping';
import { deriveStoryQuery } from '../app/lib/story-query';

const at = (iso: string, id = iso) => ({ id, publishedAt: iso });

describe('groupByPeriod', () => {
  const items = [
    at('2026-09-02T10:00:00Z', 'b'),
    at('2026-08-15T09:00:00Z', 'a'),
    at('2026-09-02T08:00:00Z', 'c'),
    at('2026-10-20T12:00:00Z', 'd'),
  ];

  it('orders story timelines oldest → newest across and within groups', () => {
    const groups = groupByPeriod(items, 'day', 'asc');
    expect(groups.map((g) => g.key)).toEqual(['2026-08-15', '2026-09-02', '2026-10-20']);
    expect(groups[1].items.map((i) => i.id)).toEqual(['c', 'b']);
  });

  it('orders the live feed newest → oldest', () => {
    const groups = groupByPeriod(items, 'day', 'desc');
    expect(groups[0].key).toBe('2026-10-20');
    expect(groups[1].items.map((i) => i.id)).toEqual(['b', 'c']);
  });

  it('buckets by month', () => {
    const groups = groupByPeriod(items, 'month', 'asc');
    expect(groups.map((g) => [g.key, g.items.length])).toEqual([
      ['2026-08', 1],
      ['2026-09', 2],
      ['2026-10', 1],
    ]);
  });
});

describe('pickGranularity', () => {
  it('uses days for short stories and months beyond ~6 weeks', () => {
    expect(pickGranularity([at('2026-10-01T00:00:00Z'), at('2026-10-20T00:00:00Z')])).toBe('day');
    expect(pickGranularity([at('2026-08-01T00:00:00Z'), at('2026-10-20T00:00:00Z')])).toBe('month');
    expect(pickGranularity([at('2026-08-01T00:00:00Z')])).toBe('day');
  });
});

describe('deriveStoryQuery', () => {
  it('keeps proper nouns first, drops stopwords and words GDELT rejects (< 3 chars)', () => {
    expect(deriveStoryQuery('EU agrees on landmark AI Act after marathon talks')).toBe('Act agrees landmark marathon');
    expect(deriveStoryQuery('The “Artemis” crew returns: what NASA learned')).toBe('Artemis NASA crew returns');
  });
});
