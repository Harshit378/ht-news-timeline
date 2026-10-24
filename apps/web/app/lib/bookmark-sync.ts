/**
 * Offline-first bookmark backup (ADR-006). Bookmarks live on the device; the server keeps a copy of the
 * whole set per device, replaced by an idempotent PUT. A change marks the set pending, and it's sent
 * after a short debounce, when the network comes back, or on app resume. Where the browser supports
 * Background Sync, the service worker can also send it with the page closed (from the outbox).
 */

export type BookmarkSyncState = 'synced' | 'pending' | 'error';

export interface BookmarkSyncStatus {
  state: BookmarkSyncState;
  lastSyncedAt: string | null;
  lastError: string | null;
}

interface Persisted {
  /** Sorted ids the server is known to hold. */
  syncedKey: string | null;
  /** Ids still to send, or null when nothing is pending. */
  pendingIds: string[] | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface BookmarkOutbox {
  write(articleIds: string[]): Promise<void>;
  clear(): Promise<void>;
}

export interface BookmarkSyncDeps {
  put(articleIds: string[]): Promise<void>;
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** True for "no network / server unreachable": stay pending and retry later. */
  isOffline(err: unknown): boolean;
  /** HTTP status of a failed request, if it got a response. 4xx won't succeed on retry. */
  statusOf(err: unknown): number | undefined;
  outbox?: BookmarkOutbox;
  requestBackgroundSync?: () => Promise<void> | void;
  onChange?: (status: BookmarkSyncStatus) => void;
  now?: () => Date;
  debounceMs?: number;
}

export const SYNC_KEY = 'ht_timeline_bookmark_sync_v1';

const EMPTY: Persisted = { syncedKey: null, pendingIds: null, lastSyncedAt: null, lastError: null };

export function idsKey(ids: Iterable<string>): string {
  return [...new Set(ids)].sort().join('\n');
}

export class BookmarkSync {
  private persisted: Persisted;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private failed = false;

  constructor(private readonly deps: BookmarkSyncDeps) {
    this.persisted = this.load();
  }

  status(): BookmarkSyncStatus {
    const { pendingIds, lastSyncedAt, lastError } = this.persisted;
    return {
      state: this.failed ? 'error' : pendingIds ? 'pending' : 'synced',
      lastSyncedAt,
      lastError,
    };
  }

  /** Called with the full current set whenever it may have changed (including on startup). */
  markChanged(articleIds: Iterable<string>) {
    const ids = [...new Set(articleIds)].sort();
    const key = ids.join('\n');
    if (key === this.persisted.syncedKey || (this.persisted.syncedKey === null && ids.length === 0)) {
      if (this.persisted.pendingIds) {
        this.update({ pendingIds: null });
        void this.deps.outbox?.clear();
      }
      this.cancelTimer();
      return;
    }
    if (this.persisted.pendingIds && idsKey(this.persisted.pendingIds) === key) {
      // Same set already queued (e.g. startup); just make sure a send is scheduled.
      this.schedule();
      return;
    }
    this.failed = false;
    this.update({ pendingIds: ids, lastError: null });
    void this.deps.outbox?.write(ids);
    this.schedule();
  }

  /** The service worker sent this set while we weren't looking. */
  confirm(articleIds: string[]) {
    const key = idsKey(articleIds);
    const pendingKey = this.persisted.pendingIds ? idsKey(this.persisted.pendingIds) : null;
    this.update({
      syncedKey: key,
      pendingIds: pendingKey === key ? null : this.persisted.pendingIds,
      lastSyncedAt: this.now().toISOString(),
    });
  }

  /** Sends the pending set now. Safe to call often: one request at a time, re-sends if it changed meanwhile. */
  flush(): Promise<void> {
    this.cancelTimer();
    if (this.inFlight) return this.inFlight.then(() => this.flush());
    const ids = this.persisted.pendingIds;
    if (!ids || this.failed) return Promise.resolve();
    const key = idsKey(ids);
    this.inFlight = this.deps
      .put(ids)
      .then(() => {
        const stillSame = this.persisted.pendingIds && idsKey(this.persisted.pendingIds) === key;
        this.update({
          syncedKey: key,
          pendingIds: stillSame ? null : this.persisted.pendingIds,
          lastSyncedAt: this.now().toISOString(),
          lastError: null,
        });
        if (stillSame) void this.deps.outbox?.clear();
      })
      .catch((err: unknown) => {
        if (this.deps.isOffline(err)) {
          void this.deps.requestBackgroundSync?.();
          return;
        }
        const status = this.deps.statusOf(err);
        const message = err instanceof Error ? err.message : 'Sync failed';
        if (status !== undefined && status >= 400 && status < 500) this.failed = true;
        this.update({ lastError: message });
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight.then(() => {
      if (this.persisted.pendingIds && !this.failed && idsKey(this.persisted.pendingIds) !== key) {
        return this.flush();
      }
    });
  }

  dispose() {
    this.cancelTimer();
  }

  private schedule() {
    this.cancelTimer();
    this.timer = setTimeout(() => void this.flush(), this.deps.debounceMs ?? 1000);
  }

  private cancelTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private now() {
    return this.deps.now?.() ?? new Date();
  }

  private load(): Persisted {
    try {
      const raw = this.deps.storage?.getItem(SYNC_KEY);
      return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Persisted>) } : { ...EMPTY };
    } catch {
      return { ...EMPTY };
    }
  }

  private update(patch: Partial<Persisted>) {
    this.persisted = { ...this.persisted, ...patch };
    try {
      this.deps.storage?.setItem(SYNC_KEY, JSON.stringify(this.persisted));
    } catch {
      // Storage full or unavailable — the in-memory state still works for this session.
    }
    this.deps.onChange?.(this.status());
  }
}

/** Cache Storage entry the service worker's `sync` handler reads (see public/sw.js). */
export const OUTBOX_CACHE = 'ht-outbox';
export const OUTBOX_PATH = '/__outbox/bookmarks';

export function cacheOutbox(url: string, userId: string): BookmarkOutbox | undefined {
  if (typeof caches === 'undefined') return undefined;
  return {
    async write(articleIds) {
      try {
        const cache = await caches.open(OUTBOX_CACHE);
        const body = JSON.stringify({ url, body: { userId, articleIds } });
        await cache.put(OUTBOX_PATH, new Response(body, { headers: { 'Content-Type': 'application/json' } }));
      } catch {
        // Outbox is a best-effort extra; the page still syncs on its own.
      }
    },
    async clear() {
      try {
        await (await caches.open(OUTBOX_CACHE)).delete(OUTBOX_PATH);
      } catch {
        // ignore
      }
    },
  };
}
