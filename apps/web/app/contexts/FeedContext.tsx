'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { buildFeedArticles, getBreakingFromArticles } from '@/app/lib/feed-data';
import {
  BOOKMARKS_URL,
  getArticle,
  getFeed,
  httpStatusOf,
  isOfflineError,
  putBookmarks,
} from '@/app/lib/api-client';
import { BookmarkSync, cacheOutbox, type BookmarkSyncStatus } from '@/app/lib/bookmark-sync';
import { getDeviceId } from '@/app/lib/device';
import { effectiveRegion, readRegionSetting, writeRegionSetting, type RegionSetting } from '@/app/lib/region';
import { requestBackgroundSync } from '@/app/components/PWAInitializer';
import { isNative } from '@/app/lib/native';
import { App } from '@capacitor/app';
import type { ArticleCategory, BreakingNewsPayload, FeedArticle } from '@/app/types/article';

const SAVED_KEY = 'ht_timeline_saved_v2';
const LEGACY_BOOKMARKS_KEY = 'ht_timeline_bookmarks_v1';
const READ_KEY = 'ht_timeline_read_v1';
const ARTICLES_CACHE_KEY = 'ht_timeline_articles_v1';

export type FeedSource = 'api' | 'cache' | 'mock';

interface FeedContextValue {
  articles: FeedArticle[];
  filteredArticles: FeedArticle[];
  categoryFilters: ArticleCategory[];
  setCategoryFilters: (next: ArticleCategory[] | ((prev: ArticleCategory[]) => ArticleCategory[])) => void;
  toggleCategoryFilter: (c: ArticleCategory) => void;
  selectAllCategories: () => void;
  activeArticleId: string | null;
  activeArticle: FeedArticle | null;
  /** Opens the article overlay; pushes `?article=` so back gesture closes it. */
  openArticle: (article: FeedArticle | string) => void;
  closeArticle: () => void;
  /** Called by ArticleUrlSync when the `?article=` param changes. */
  syncActiveArticleFromUrl: (id: string | null) => void;
  /** Register articles fetched outside the feed (story timelines, search) so they can be opened. */
  rememberArticles: (items: FeedArticle[]) => void;
  breaking: BreakingNewsPayload | null;
  dismissBreaking: () => void;
  savedArticles: FeedArticle[];
  bookmarkIds: Set<string>;
  /** Server backup of this device's bookmarks (ADR-006). */
  bookmarkSync: BookmarkSyncStatus;
  /** Region preference for feed ranking (ADR-009) and the region actually sent. */
  regionSetting: RegionSetting;
  region: string | undefined;
  setRegionSetting: (value: RegionSetting) => void;
  toggleBookmark: (article: FeedArticle | string) => void;
  isBookmarked: (articleId: string) => boolean;
  readIds: Set<string>;
  setRead: (articleId: string, read: boolean) => void;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  source: FeedSource | null;
  error: string | null;
}

const FeedContext = createContext<FeedContextValue | undefined>(undefined);

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — non-fatal.
  }
}

function sortNewestFirst(items: FeedArticle[]) {
  return [...items].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

function mergeById(prev: FeedArticle[], next: FeedArticle[]) {
  const map = new Map(prev.map((a) => [a.id, a]));
  for (const a of next) map.set(a.id, a);
  return sortNewestFirst([...map.values()]);
}

function articleUrl(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('article', id);
  else url.searchParams.delete('article');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function FeedProvider({ children }: { children: ReactNode }) {
  const [articles, setArticles] = useState<FeedArticle[]>([]);
  const [extra, setExtra] = useState<Map<string, FeedArticle>>(() => new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [source, setSource] = useState<FeedSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilters, setCategoryFilters] = useState<ArticleCategory[]>([]);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, FeedArticle>>({});
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [breakingVisible, setBreakingVisible] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const pushedArticle = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const syncRef = useRef<BookmarkSync | null>(null);
  // 'auto' until hydrated, so the server render and first client render agree.
  const [regionSetting, setRegionSettingState] = useState<RegionSetting>('auto');
  const [regionReady, setRegionReady] = useState(false);
  const region = useMemo(() => (regionReady ? effectiveRegion(regionSetting) : undefined), [regionReady, regionSetting]);
  const [bookmarkSync, setBookmarkSync] = useState<BookmarkSyncStatus>({
    state: 'synced',
    lastSyncedAt: null,
    lastError: null,
  });

  // Restore saved articles + read state (migrating v1 id-only bookmarks).
  useEffect(() => {
    const savedMap = readJson<Record<string, FeedArticle>>(SAVED_KEY, {});
    const legacyIds = readJson<unknown>(LEGACY_BOOKMARKS_KEY, []);
    if (Array.isArray(legacyIds) && legacyIds.length > 0) {
      const known = new Map(buildFeedArticles().map((a) => [a.id, a]));
      for (const id of legacyIds) {
        if (typeof id === 'string' && !savedMap[id] && known.has(id)) savedMap[id] = known.get(id)!;
      }
      localStorage.removeItem(LEGACY_BOOKMARKS_KEY);
    }
    setSaved(savedMap);
    setReadIds(new Set(readJson<string[]>(READ_KEY, [])));
    setRegionSettingState(readRegionSetting());
    setRegionReady(true);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeJson(SAVED_KEY, saved);
  }, [saved, hydrated]);

  // Bookmark backup: created once on the client, then fed the full set on every change.
  useEffect(() => {
    const deviceId = getDeviceId();
    const sync = new BookmarkSync({
      put: (ids) => putBookmarks(deviceId, ids),
      storage: typeof window === 'undefined' ? null : window.localStorage,
      isOffline: isOfflineError,
      statusOf: httpStatusOf,
      outbox: cacheOutbox(BOOKMARKS_URL, deviceId),
      requestBackgroundSync: () => requestBackgroundSync('sync-bookmarks'),
      onChange: setBookmarkSync,
    });
    syncRef.current = sync;
    setBookmarkSync(sync.status());

    const retry = () => {
      if (document.visibilityState === 'visible') void sync.flush();
    };
    const onWorkerMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; articleIds?: unknown } | null;
      if (data?.type === 'bookmarks-synced' && Array.isArray(data.articleIds)) {
        sync.confirm(data.articleIds.filter((id): id is string => typeof id === 'string'));
      }
    };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    navigator.serviceWorker?.addEventListener('message', onWorkerMessage);
    // Capacitor: the WebView's 'online' event isn't reliable after the app was suspended, so also retry on resume.
    let disposed = false;
    let removeResume: (() => void) | undefined;
    if (isNative()) {
      void App.addListener('resume', () => void sync.flush()).then((handle) => {
        if (disposed) void handle.remove();
        else removeResume = () => void handle.remove();
      });
    }
    return () => {
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', retry);
      navigator.serviceWorker?.removeEventListener('message', onWorkerMessage);
      disposed = true;
      removeResume?.();
      sync.dispose();
      syncRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (hydrated) syncRef.current?.markChanged(Object.keys(saved));
  }, [saved, hydrated]);

  useEffect(() => {
    if (hydrated) writeJson(READ_KEY, [...readIds]);
  }, [readIds, hydrated]);

  // First page: API → cached API payload → bundled mock stories.
  useEffect(() => {
    if (!regionReady) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getFeed(1, undefined, region);
        if (cancelled) return;
        const items = sortNewestFirst(res.items);
        setArticles(items);
        setHasMore(res.hasMore);
        setPage(1);
        setSource('api');
        writeJson(ARTICLES_CACHE_KEY, items);
      } catch (err) {
        if (cancelled) return;
        const cached = readJson<FeedArticle[]>(ARTICLES_CACHE_KEY, []);
        if (cached.length > 0) {
          setArticles(sortNewestFirst(cached));
          setSource('cache');
        } else {
          setArticles(buildFeedArticles());
          setSource('mock');
        }
        setHasMore(false);
        setError(err instanceof Error ? err.message : 'Failed to load articles');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, regionReady, region]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || source !== 'api') return;
    setIsLoadingMore(true);
    try {
      const res = await getFeed(page + 1, undefined, region);
      setArticles((prev) => mergeById(prev, res.items));
      setHasMore(res.hasMore);
      setPage(page + 1);
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, page, source, region]);

  const setRegionSetting = useCallback((value: RegionSetting) => {
    writeRegionSetting(value);
    setRegionSettingState(value);
  }, []);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const lookup = useCallback(
    (id: string) => articles.find((a) => a.id === id) ?? extra.get(id) ?? saved[id] ?? null,
    [articles, extra, saved]
  );

  const activeArticle = useMemo(
    () => (activeArticleId ? lookup(activeArticleId) : null),
    [activeArticleId, lookup]
  );

  // Deep link to an article we don't have locally → fetch it.
  useEffect(() => {
    if (!activeArticleId || activeArticle || isLoading) return;
    let cancelled = false;
    getArticle(activeArticleId)
      .then((a) => {
        if (!cancelled) setExtra((prev) => new Map(prev).set(a.id, a));
      })
      .catch(() => {
        // Unknown id — ignore; overlay simply won't render.
      });
    return () => {
      cancelled = true;
    };
  }, [activeArticleId, activeArticle, isLoading]);

  const rememberArticles = useCallback((items: FeedArticle[]) => {
    if (items.length === 0) return;
    setExtra((prev) => {
      const next = new Map(prev);
      for (const a of items) next.set(a.id, a);
      return next;
    });
  }, []);

  const setRead = useCallback((articleId: string, read: boolean) => {
    setReadIds((prev) => {
      if (prev.has(articleId) === read) return prev;
      const next = new Set(prev);
      if (read) next.add(articleId);
      else next.delete(articleId);
      return next;
    });
  }, []);

  const openArticle = useCallback(
    (article: FeedArticle | string) => {
      const id = typeof article === 'string' ? article : article.id;
      if (typeof article !== 'string') rememberArticles([article]);
      setActiveArticleId(id);
      setRead(id, true);
      if (!pushedArticle.current) {
        window.history.pushState(null, '', articleUrl(id));
        pushedArticle.current = true;
      } else {
        window.history.replaceState(null, '', articleUrl(id));
      }
    },
    [rememberArticles, setRead]
  );

  const closeArticle = useCallback(() => {
    if (pushedArticle.current) {
      // Pop the entry we pushed; ArticleUrlSync clears state on popstate.
      window.history.back();
    } else {
      window.history.replaceState(null, '', articleUrl(null));
      setActiveArticleId(null);
    }
  }, []);

  const syncActiveArticleFromUrl = useCallback(
    (id: string | null) => {
      if (!id) pushedArticle.current = false;
      setActiveArticleId(id);
      if (id) setRead(id, true);
    },
    [setRead]
  );

  const breaking = useMemo(() => {
    if (!breakingVisible) return null;
    return getBreakingFromArticles(articles);
  }, [articles, breakingVisible]);

  // Auto-dismiss breaking news after 60s
  useEffect(() => {
    if (!breaking) return;
    const t = window.setTimeout(() => setBreakingVisible(false), 60_000);
    return () => window.clearTimeout(t);
  }, [breaking]);

  const filteredArticles = useMemo(() => {
    if (categoryFilters.length === 0) return articles;
    const set = new Set(categoryFilters);
    return articles.filter((a) => set.has(a.category));
  }, [articles, categoryFilters]);

  const toggleCategoryFilter = useCallback((c: ArticleCategory) => {
    setCategoryFilters((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }, []);

  const selectAllCategories = useCallback(() => setCategoryFilters([]), []);
  const dismissBreaking = useCallback(() => setBreakingVisible(false), []);

  const toggleBookmark = useCallback(
    (article: FeedArticle | string) => {
      const resolved = typeof article === 'string' ? lookup(article) : article;
      if (!resolved) return;
      setSaved((prev) => {
        const next = { ...prev };
        if (next[resolved.id]) delete next[resolved.id];
        else next[resolved.id] = resolved;
        return next;
      });
    },
    [lookup]
  );

  const bookmarkIds = useMemo(() => new Set(Object.keys(saved)), [saved]);
  const savedArticles = useMemo(() => sortNewestFirst(Object.values(saved)), [saved]);
  const isBookmarked = useCallback((articleId: string) => articleId in saved, [saved]);

  const value: FeedContextValue = {
    articles,
    filteredArticles,
    categoryFilters,
    setCategoryFilters,
    toggleCategoryFilter,
    selectAllCategories,
    activeArticleId,
    activeArticle,
    openArticle,
    closeArticle,
    syncActiveArticleFromUrl,
    rememberArticles,
    breaking,
    dismissBreaking,
    savedArticles,
    bookmarkIds,
    bookmarkSync,
    regionSetting,
    region,
    setRegionSetting,
    toggleBookmark,
    isBookmarked,
    readIds,
    setRead,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
    source,
    error,
  };

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useFeed() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error('useFeed must be used within FeedProvider');
  return ctx;
}
