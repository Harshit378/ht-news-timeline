const KEY = 'ht_timeline_recent_searches_v1';
const MAX = 8;

export function getRecentSearches(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(q: string): string[] {
  const term = q.trim();
  if (!term) return getRecentSearches();
  const next = [term, ...getRecentSearches().filter((s) => s.toLowerCase() !== term.toLowerCase())].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // non-fatal
  }
  return next;
}

export function clearRecentSearches() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // non-fatal
  }
}
