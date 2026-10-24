import { describe, expect, it } from 'vitest';
import { REGION_KEY, effectiveRegion, readRegionSetting, regionFromLocale, writeRegionSetting } from '../app/lib/region';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('region preference', () => {
  it('reads the country from a locale', () => {
    expect(regionFromLocale('en-IN')).toBe('IN');
    expect(regionFromLocale('hi-Deva-IN')).toBe('IN');
    expect(regionFromLocale('en_GB')).toBe('GB');
    expect(regionFromLocale('en')).toBeNull();
    expect(regionFromLocale(undefined)).toBeNull();
  });

  it('defaults to auto, follows the locale, and can be turned off or pinned', () => {
    const s = new MemoryStorage();
    expect(readRegionSetting(s)).toBe('auto');
    expect(effectiveRegion('auto', 'en-IN')).toBe('IN');
    expect(effectiveRegion('auto', 'en')).toBeUndefined();
    writeRegionSetting('off', s);
    expect(readRegionSetting(s)).toBe('off');
    expect(effectiveRegion('off', 'en-IN')).toBeUndefined();
    writeRegionSetting('GB', s);
    expect(effectiveRegion(readRegionSetting(s), 'en-IN')).toBe('GB');
  });

  it('ignores corrupt stored values', () => {
    const s = new MemoryStorage();
    s.setItem(REGION_KEY, 'not-a-region');
    expect(readRegionSetting(s)).toBe('auto');
  });
});
