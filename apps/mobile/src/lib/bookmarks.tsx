import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import type { FeedArticle } from '@ht/shared/article';
import { BookmarkSync, type BookmarkSyncStatus } from '@ht/shared/bookmark-sync';
import { getDeviceId } from '@ht/shared/device';
import { httpStatusOf, isOfflineError } from '@ht/shared/news-api';
import { newsApi } from './api';
import { kv, readJson, writeJson } from './storage';

/** Same key and shape as the web app's saved articles (full snapshots, readable offline). */
const SAVED_KEY = 'ht_timeline_saved_v2';

interface BookmarksValue {
  saved: FeedArticle[];
  isSaved: (id: string) => boolean;
  toggle: (article: FeedArticle) => void;
  sync: BookmarkSyncStatus;
}

const BookmarksContext = createContext<BookmarksValue | undefined>(undefined);

/**
 * Offline-first bookmarks (ADR-006) on the shared BookmarkSync engine. Storage is SQLite (kv-store) instead of
 * localStorage, and the flush triggers are NetInfo (network back) and AppState (app foregrounded) — the
 * native counterparts of the web app's `online` / `visibilitychange`. There is no service worker here, so no
 * outbox for closed-app sync: pending changes go out the next time the app is active and online.
 */
export function BookmarksProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Record<string, FeedArticle>>(() => readJson(SAVED_KEY, {}));
  const syncRef = useRef<BookmarkSync | null>(null);
  const [sync, setSync] = useState<BookmarkSyncStatus>({ state: 'synced', lastSyncedAt: null, lastError: null });

  useEffect(() => {
    const deviceId = getDeviceId(kv, (bytes) => Crypto.getRandomValues(bytes));
    const engine = new BookmarkSync({
      put: (ids) => newsApi.putBookmarks(deviceId, ids),
      storage: kv,
      isOffline: isOfflineError,
      statusOf: httpStatusOf,
      onChange: setSync,
    });
    syncRef.current = engine;
    setSync(engine.status());
    const net = NetInfo.addEventListener((s) => {
      if (s.isConnected) void engine.flush();
    });
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void engine.flush();
    });
    return () => {
      net();
      app.remove();
      engine.dispose();
      syncRef.current = null;
    };
  }, []);

  // Skip the first run: writing the initial state back would turn a failed read into an erased list.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) writeJson(SAVED_KEY, saved);
    mountedRef.current = true;
    syncRef.current?.markChanged(Object.keys(saved));
  }, [saved]);

  const toggle = useCallback((article: FeedArticle) => {
    setSaved((prev) => {
      const next = { ...prev };
      if (next[article.id]) delete next[article.id];
      else next[article.id] = article;
      return next;
    });
  }, []);

  const value = useMemo<BookmarksValue>(
    () => ({
      saved: Object.values(saved).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
      isSaved: (id) => id in saved,
      toggle,
      sync,
    }),
    [saved, toggle, sync],
  );

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}

export function useBookmarks() {
  const ctx = useContext(BookmarksContext);
  if (!ctx) throw new Error('useBookmarks must be used within BookmarksProvider');
  return ctx;
}
