import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookmarkSync, SYNC_KEY, type BookmarkSyncDeps } from '../app/lib/bookmark-sync';
import { getDeviceId, newDeviceId } from '../app/lib/device';
import { buildCsp } from '../app/lib/csp';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

const OFFLINE = Object.assign(new Error('Network Error'), { offline: true });
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

function setup(overrides: Partial<BookmarkSyncDeps> = {}, storage = new MemoryStorage()) {
  const put = vi.fn<(ids: string[]) => Promise<void>>(async () => undefined);
  const outbox = { write: vi.fn(async () => undefined), clear: vi.fn(async () => undefined) };
  const requestBackgroundSync = vi.fn();
  const sync = new BookmarkSync({
    put,
    storage,
    isOffline: (e) => (e as { offline?: boolean }).offline === true,
    statusOf: (e) => (e as { status?: number }).status,
    outbox,
    requestBackgroundSync,
    now: () => new Date('2026-10-25T10:00:00Z'),
    debounceMs: 1000,
    ...overrides,
  });
  return { sync, put, outbox, requestBackgroundSync, storage };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('BookmarkSync', () => {
  it('debounces changes into one PUT of the full set', async () => {
    const { sync, put, outbox } = setup();
    sync.markChanged(['a']);
    sync.markChanged(['a', 'b']);
    expect(sync.status().state).toBe('pending');
    expect(outbox.write).toHaveBeenLastCalledWith(['a', 'b']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(['a', 'b']);
    expect(sync.status()).toEqual({ state: 'synced', lastSyncedAt: '2026-10-25T10:00:00.000Z', lastError: null });
    expect(outbox.clear).toHaveBeenCalled();
  });

  it('does nothing when there is nothing new to send', async () => {
    const { sync, put } = setup();
    sync.markChanged([]); // first run, no bookmarks
    await vi.advanceTimersByTimeAsync(2000);
    expect(put).not.toHaveBeenCalled();
    expect(sync.status().state).toBe('synced');
  });

  it('pushes existing bookmarks on first run, and not again once synced', async () => {
    const storage = new MemoryStorage();
    const first = setup({}, storage);
    first.sync.markChanged(['x', 'y']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(first.put).toHaveBeenCalledTimes(1);

    const second = setup({}, storage); // next app start
    second.sync.markChanged(['y', 'x']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(second.put).not.toHaveBeenCalled();
  });

  it('stays pending offline, asks for background sync, and sends on the next flush', async () => {
    const { sync, put, requestBackgroundSync } = setup();
    put.mockRejectedValueOnce(OFFLINE);
    sync.markChanged(['a']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sync.status().state).toBe('pending');
    expect(requestBackgroundSync).toHaveBeenCalled();

    await sync.flush(); // e.g. the 'online' event
    expect(put).toHaveBeenCalledTimes(2);
    expect(sync.status().state).toBe('synced');
  });

  it('survives a restart while pending', async () => {
    const storage = new MemoryStorage();
    const first = setup({}, storage);
    first.put.mockRejectedValue(OFFLINE);
    first.sync.markChanged(['a']);
    await vi.advanceTimersByTimeAsync(1000);
    first.sync.dispose();

    const second = setup({}, storage);
    expect(second.sync.status().state).toBe('pending');
    await second.sync.flush();
    expect(second.put).toHaveBeenCalledWith(['a']);
    expect(JSON.parse(storage.getItem(SYNC_KEY)!).pendingIds).toBeNull();
  });

  it('runs one request at a time and re-sends if the set changed mid-flight', async () => {
    const { sync, put } = setup();
    let release!: () => void;
    put.mockImplementationOnce(() => new Promise<void>((r) => (release = r)));
    sync.markChanged(['a']);
    const flushing = sync.flush();
    sync.markChanged(['a', 'b']);
    void sync.flush(); // must not start a second concurrent PUT
    expect(put).toHaveBeenCalledTimes(1);
    release();
    await flushing;
    await vi.runAllTimersAsync();
    expect(put).toHaveBeenCalledTimes(2);
    expect(put).toHaveBeenLastCalledWith(['a', 'b']);
    expect(sync.status().state).toBe('synced');
  });

  it('stops retrying after a 4xx until the set changes', async () => {
    const { sync, put } = setup();
    put.mockRejectedValueOnce(httpError(400));
    sync.markChanged(['a']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sync.status()).toMatchObject({ state: 'error', lastError: 'HTTP 400' });
    await sync.flush();
    expect(put).toHaveBeenCalledTimes(1);

    sync.markChanged(['a', 'b']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(put).toHaveBeenCalledTimes(2);
    expect(sync.status().state).toBe('synced');
  });

  it('keeps retrying after a 5xx', async () => {
    const { sync, put } = setup();
    put.mockRejectedValueOnce(httpError(503));
    sync.markChanged(['a']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sync.status()).toMatchObject({ state: 'pending', lastError: 'HTTP 503' });
    await sync.flush();
    expect(sync.status().state).toBe('synced');
  });

  it('accepts confirmation from the service worker', () => {
    const { sync } = setup();
    sync.markChanged(['b', 'a']);
    sync.confirm(['a', 'b']);
    expect(sync.status().state).toBe('synced');
  });
});

describe('device id', () => {
  it('generates RFC 4122 v4 ids', () => {
    expect(newDeviceId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('is stable per device and replaces corrupt values', () => {
    const storage = new MemoryStorage();
    const id = getDeviceId(storage);
    expect(getDeviceId(storage)).toBe(id);
    storage.setItem('ht_timeline_device_v1', 'local');
    expect(getDeviceId(storage)).not.toBe('local');
  });
});

describe('buildCsp', () => {
  it('allows the API and socket origins and blocks plugins', () => {
    const csp = buildCsp('https://api.example.com/api', 'wss://api.example.com/ws/events');
    expect(csp).toContain("connect-src 'self' https://api.example.com wss://api.example.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });
});
