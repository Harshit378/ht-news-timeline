import Storage from 'expo-sqlite/kv-store';

/**
 * Synchronous key-value storage on SQLite (ADR-001 Path B / ADR-006): the same `getItem` / `setItem` shape as
 * the browser's localStorage, so shared code (BookmarkSync, device id) runs unchanged.
 */
export const kv: Pick<globalThis.Storage, 'getItem' | 'setItem'> = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
};

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = kv.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    kv.setItem(key, JSON.stringify(value));
  } catch {
    // non-fatal
  }
}
