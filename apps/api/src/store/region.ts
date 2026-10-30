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

/**
 * Resolves user region using the ADR-009 fallback order:
 * 1. Explicit query parameter ('IN', 'GB', etc.; 'off' explicitly clears)
 * 2. Edge reverse-proxy coarse IP country headers (Cloudflare, Vercel, CloudFront, etc.)
 * 3. Accept-Language header country tag (e.g. 'en-IN,en;q=0.9')
 */
export function extractCoarseRegion(
  headers: Record<string, string | string[] | undefined>,
  queryRegion?: string,
): string | null {
  if (queryRegion) {
    const trimmed = queryRegion.trim().toLowerCase();
    if (trimmed === 'off' || trimmed === 'none') return null;
    if (trimmed !== 'auto') {
      const parsed = parseRegion(queryRegion);
      if (parsed) return parsed;
    }
  }

  // Edge geo headers (coarse country level only, no IP storage - ADR-009)
  const headerKeys = [
    'cf-ipcountry',
    'x-country-code',
    'x-vercel-ip-country',
    'cloudfront-viewer-country',
    'x-geo-country',
  ];

  for (const key of headerKeys) {
    const val = headers[key];
    const candidate = Array.isArray(val) ? val[0] : val;
    if (candidate) {
      const parsed = parseRegion(candidate);
      if (parsed && parsed !== 'XX' && parsed !== 'T1') return parsed;
    }
  }

  // Accept-Language fallback
  const acceptLang = headers['accept-language'];
  const rawLang = Array.isArray(acceptLang) ? acceptLang[0] : acceptLang;
  if (rawLang) {
    // Matches e.g. en-US, hi-IN, en-GB
    const match = rawLang.match(/[a-z]{2,3}-([A-Z]{2})/i);
    if (match?.[1]) {
      return parseRegion(match[1]);
    }
  }

  return null;
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
