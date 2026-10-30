/**
 * Reader's region for feed ranking (ADR-009). Stored on the device only; never derived from IP.
 * 'auto' follows the device locale (e.g. en-IN → IN), 'off' disables the boost, or an explicit country.
 */
export const REGION_KEY = 'ht_timeline_region_v1';

/** Regions with dedicated curated feeds today; others still work via `auto` but have little to boost. */
export const REGIONS = [
  { code: 'IN', label: 'India' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
] as const;

export type RegionSetting = 'auto' | 'off' | string;

/** Country part of a BCP 47 locale ("en-IN" → "IN", "hi-Deva-IN" → "IN"); null when there is none. */
export function regionFromLocale(locale: string | undefined | null): string | null {
  if (!locale) return null;
  const parts = locale.replace(/_/g, '-').split('-').slice(1);
  const country = parts.find((p) => /^[A-Za-z]{2}$/.test(p));
  return country ? country.toUpperCase() : null;
}

export function readRegionSetting(storage: Pick<Storage, 'getItem'> | null = safeStorage()): RegionSetting {
  try {
    const v = storage?.getItem(REGION_KEY);
    return v === 'off' || v === 'auto' || (v && /^[A-Z]{2}$/.test(v)) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function writeRegionSetting(value: RegionSetting, storage: Pick<Storage, 'setItem'> | null = safeStorage()) {
  try {
    storage?.setItem(REGION_KEY, value);
  } catch {
    // non-fatal: the setting just won't persist
  }
}

/** The region to send to the API, or undefined for no boost. */
export function effectiveRegion(
  setting: RegionSetting,
  locale: string | undefined = typeof navigator === 'undefined' ? undefined : navigator.language,
): string | undefined {
  if (setting === 'off') return undefined;
  if (setting === 'auto') return regionFromLocale(locale) ?? undefined;
  return setting;
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
