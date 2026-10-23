export type Granularity = 'day' | 'month';

export interface DatedItem {
  publishedAt: string;
}

export interface TimelineGroup<T> {
  key: string;
  label: string;
  items: T[];
}

const DAY_MS = 86_400_000;

function periodKey(d: Date, granularity: Granularity) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  if (granularity === 'month') return `${d.getFullYear()}-${m}`;
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`;
}

function periodLabel(d: Date, granularity: Granularity) {
  return granularity === 'month'
    ? d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Groups items into day or month buckets. Items keep their order inside a group and
 * groups follow `order` (story timelines read oldest → newest; the live feed newest → oldest).
 */
export function groupByPeriod<T extends DatedItem>(
  items: T[],
  granularity: Granularity,
  order: 'asc' | 'desc' = 'desc'
): TimelineGroup<T>[] {
  const sorted = [...items].sort((a, b) => {
    const diff = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
    return order === 'asc' ? diff : -diff;
  });
  const groups = new Map<string, TimelineGroup<T>>();
  for (const item of sorted) {
    const d = new Date(item.publishedAt);
    const key = periodKey(d, granularity);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: periodLabel(d, granularity), items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return [...groups.values()];
}

/** Day buckets for short stories, month buckets once a story spans more than ~6 weeks. */
export function pickGranularity(items: DatedItem[]): Granularity {
  if (items.length < 2) return 'day';
  const times = items.map((i) => new Date(i.publishedAt).getTime());
  return Math.max(...times) - Math.min(...times) > 45 * DAY_MS ? 'month' : 'day';
}
