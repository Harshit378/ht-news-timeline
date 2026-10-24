import { describe, expect, it } from 'vitest';
import { applyAndroid, applyIos, buildNumberFor } from '../../../scripts/sync-native-version.mjs';
import { releaseProblems, secretLookingPublicVars } from '../../../scripts/check-release-env.mjs';

describe('sync-native-version', () => {
  it('derives an increasing build number from semver', () => {
    expect(buildNumberFor('0.0.1')).toBe(1);
    expect(buildNumberFor('1.2.3')).toBe(1_002_003);
    expect(buildNumberFor('1.10.0')).toBeGreaterThan(buildNumberFor('1.9.99'));
    expect(() => buildNumberFor('1.2')).toThrow();
    expect(() => buildNumberFor('1.1000.0')).toThrow();
  });

  it('rewrites Android and iOS version fields', () => {
    expect(applyAndroid('versionCode 1\n        versionName "1.0"', '1.4.0', 1004000)).toBe(
      'versionCode 1004000\n        versionName "1.4.0"',
    );
    const pbx = 'MARKETING_VERSION = 1.0;\nCURRENT_PROJECT_VERSION = 1;\nMARKETING_VERSION = 1.0;';
    expect(applyIos(pbx, '1.4.0', 1004000)).toBe(
      'MARKETING_VERSION = 1.4.0;\nCURRENT_PROJECT_VERSION = 1004000;\nMARKETING_VERSION = 1.4.0;',
    );
  });
});

describe('check-release-env', () => {
  it('accepts a public https API', () => {
    expect(releaseProblems({ NEXT_PUBLIC_API_URL: 'https://api.example.com/api', NEXT_PUBLIC_WS_URL: 'wss://api.example.com/ws/events' })).toEqual([]);
  });

  it('blocks dev, LAN, plain-http and malformed URLs', () => {
    expect(releaseProblems({})).toEqual(['NEXT_PUBLIC_API_URL is not set']);
    expect(releaseProblems({ NEXT_PUBLIC_API_URL: 'http://localhost:4000/api' }).join(' ')).toMatch(/https.*local/);
    expect(releaseProblems({ NEXT_PUBLIC_API_URL: 'https://192.168.1.20/api' })[0]).toMatch(/local\/LAN/);
    expect(releaseProblems({ NEXT_PUBLIC_API_URL: 'https://api.example.com' })[0]).toMatch(/end in \/api/);
    expect(releaseProblems({ NEXT_PUBLIC_API_URL: 'https://api.example.com/api', NEXT_PUBLIC_WS_URL: 'ws://api.example.com/ws' })[0]).toMatch(/wss/);
  });

  it('flags secret-looking public variables', () => {
    expect(secretLookingPublicVars({ NEXT_PUBLIC_NEWS_API_KEY: 'x', NEXT_PUBLIC_API_URL: 'y', NEWS_API_KEY: 'z' })).toEqual([
      'NEXT_PUBLIC_NEWS_API_KEY',
    ]);
  });
});
