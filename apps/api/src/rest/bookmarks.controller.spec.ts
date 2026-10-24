import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { BookmarksController, parseArticleIds, parseUserId } from './bookmarks.controller';

const DEVICE = '3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f';

describe('parseUserId', () => {
  it('accepts device UUIDs and the legacy local id', () => {
    expect(parseUserId(DEVICE)).toBe(DEVICE);
    expect(parseUserId(DEVICE.toUpperCase())).toBe(DEVICE);
    expect(parseUserId('local')).toBe('local');
    expect(parseUserId(undefined)).toBe('local');
  });

  it('rejects anything else', () => {
    expect(() => parseUserId('alice')).toThrow();
    expect(() => parseUserId(42)).toThrow();
    expect(() => parseUserId({ $ne: null })).toThrow();
  });
});

describe('parseArticleIds', () => {
  it('dedupes valid ids', () => {
    expect(parseArticleIds(['a', 'b', 'a'])).toEqual(['a', 'b']);
    expect(parseArticleIds(undefined)).toEqual([]);
  });

  it('rejects non-arrays, bad entries and oversized sets', () => {
    expect(() => parseArticleIds('a')).toThrow();
    expect(() => parseArticleIds(['a', 1])).toThrow();
    expect(() => parseArticleIds([''])).toThrow();
    expect(() => parseArticleIds(Array.from({ length: 1001 }, (_, i) => `a${i}`))).toThrow();
  });
});

describe('BookmarksController.put', () => {
  it('replaces the device set through the store', async () => {
    const store = { putBookmarks: vi.fn(async (ids: string[]) => ({ ok: true, articleIds: ids, missing: [] })) };
    const controller = new BookmarksController(store as never);
    await controller.put({ userId: DEVICE, articleIds: ['a', 'a', 'b'] });
    expect(store.putBookmarks).toHaveBeenCalledWith(['a', 'b'], DEVICE);
  });
});
