import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { CORE_TOPICS, type ArticleCategory } from '@ht/shared/article';
import type { TopicCount } from '@ht/shared/news-api';
import { newsApi } from '@/lib/api';
import { readJson, writeJson } from '@/lib/storage';
import { colors, fonts } from '@/theme';

const TOPICS_CACHE_KEY = 'ht_timeline_topics_counts_v1';

export default function TopicsScreen() {
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    readJson(TOPICS_CACHE_KEY, {}),
  );
  const [loading, setLoading] = useState(Object.keys(counts).length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const topics = await newsApi.getTopics();
      const map: Record<string, number> = {};
      for (const t of topics) map[t.slug] = t.count;
      setCounts(map);
      writeJson(TOPICS_CACHE_KEY, map);
    } catch {
      // offline cache remains
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && Object.keys(counts).length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={CORE_TOPICS}
        keyExtractor={(item) => item.slug}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void load();
        }}
        renderItem={({ item }) => {
          const count = counts[item.slug] ?? 0;
          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/story',
                  params: { q: item.name, category: item.slug },
                })
              }
              style={({ pressed }) => [
                styles.tile,
                { borderTopColor: item.tint },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${count} articles`}
            >
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.count}>
                {count > 0 ? `${count} reports` : 'Explore'}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  list: { padding: 16, gap: 12 },
  row: { gap: 12 },
  tile: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 3,
    borderRadius: 10,
    padding: 16,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  pressed: { opacity: 0.7 },
  emoji: { fontSize: 24, marginBottom: 8 },
  name: { fontFamily: fonts.serif, fontSize: 16, fontWeight: '700', color: colors.ink },
  count: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted, marginTop: 4 },
});
