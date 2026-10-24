/**
 * Region-aware ranking (ADR-009). Articles carry their outlet's country (ISO 3166-1 alpha-2) or GLOBAL.
 * The feed is boosted, never filtered: the reader's region gets a fixed share of each page (`REGION_SHARE`),
 * interleaved with everything else, each side newest first. A time bonus was tried first and rejected:
 * prolific outlets (Times of India has 10 feeds) took the whole first page even with a 1-hour bonus.
 */
export const REGION_SHARE = 0.4;
export const GLOBAL = 'GLOBAL';

/** Normalizes a client-supplied region; null for anything that isn't a two-letter code. */
export function parseRegion(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** GDELT `sourcecountry` names for the countries our feeds and readers cover; others stay unknown. */
const GDELT_COUNTRIES: Record<string, string> = {
  'united states': 'US',
  'united kingdom': 'GB',
  india: 'IN',
  canada: 'CA',
  australia: 'AU',
  ireland: 'IE',
  'new zealand': 'NZ',
  'south africa': 'ZA',
  pakistan: 'PK',
  bangladesh: 'BD',
  'sri lanka': 'LK',
  nepal: 'NP',
  singapore: 'SG',
  nigeria: 'NG',
  kenya: 'KE',
  philippines: 'PH',
  qatar: 'QA',
  'united arab emirates': 'AE',
  germany: 'DE',
  france: 'FR',
  japan: 'JP',
};

export function regionFromGdeltCountry(country: string | undefined): string | null {
  return country ? (GDELT_COUNTRIES[country.trim().toLowerCase()] ?? null) : null;
}

/**
 * Interleaves regional and other articles so regional ones fill about `share` of every page.
 * Position key = rank within its group / group share — the same ordering the SQL in NewsStore uses.
 */
export function interleaveByRegion<T extends { publishedAt: Date; region?: string | null; id: string }>(
  items: T[],
  region: string,
  share = REGION_SHARE,
): T[] {
  const newest = (a: T, b: T) => b.publishedAt.getTime() - a.publishedAt.getTime() || a.id.localeCompare(b.id);
  const local = items.filter((a) => a.region === region).sort(newest);
  const other = items.filter((a) => a.region !== region).sort(newest);
  const keyed = [
    ...local.map((a, i) => ({ a, key: (i + 1) / share })),
    ...other.map((a, i) => ({ a, key: (i + 1) / (1 - share) })),
  ];
  return keyed.sort((x, y) => x.key - y.key || newest(x.a, y.a)).map((x) => x.a);
}
