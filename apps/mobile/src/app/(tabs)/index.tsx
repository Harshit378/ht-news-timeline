import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { FeedArticle } from '@ht/shared/article';
import { isOfflineError } from '@ht/shared/news-api';
import { groupByPeriod } from '@ht/shared/timeline-grouping';
import { Timeline } from '@/components/Timeline';
import { newsApi } from '@/lib/api';
import { rememberArticles } from '@/lib/articles';
import { readJson, writeJson } from '@/lib/storage';
import { colors } from '@/theme';

const FEED_CACHE_KEY = 'ht_timeline_articles_v1';

function mergeById(prev: FeedArticle[], next: FeedArticle[]) {
  const map = new Map(prev.map((a) => [a.id, a]));
  for (const a of next) map.set(a.id, a);
  return [...map.values()];
}

/** Home feed: newest first, grouped by day; the last good page is cached for offline starts. */
export default function FeedScreen() {
  const [items, setItems] = useState<FeedArticle[]>(() => readJson(FEED_CACHE_KEY, []));
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await newsApi.getFeed(1);
      setItems(res.items);
      setHasMore(res.hasMore);
      setPage(1);
      setOffline(false);
      rememberArticles(res.items);
      writeJson(FEED_CACHE_KEY, res.items);
    } catch (err) {
      setOffline(isOfflineError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    try {
      const res = await newsApi.getFeed(page + 1);
      setItems((prev) => mergeById(prev, res.items));
      setHasMore(res.hasMore);
      setPage(page + 1);
      rememberArticles(res.items);
    } catch {
      setHasMore(false);
    }
  }, [hasMore, loading, page]);

  const groups = useMemo(() => groupByPeriod(items, 'day', 'desc'), [items]);

  if (loading && items.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <Timeline
      groups={groups}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load();
      }}
      onEndReached={loadMore}
      header={
        offline ? (
          <Text style={styles.notice}>Offline — showing the last saved feed.</Text>
        ) : items.length === 0 ? (
          <Text style={styles.notice}>No stories yet. Pull to refresh.</Text>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  notice: { color: colors.muted, fontSize: 13, paddingHorizontal: 16, paddingVertical: 10 },
});
