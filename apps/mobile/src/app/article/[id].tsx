import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { FeedArticle } from '@ht/shared/article';
import { newsApi } from '@/lib/api';
import { knownArticle } from '@/lib/articles';
import { useBookmarks } from '@/lib/bookmarks';
import { colors, fonts } from '@/theme';

/** Article detail: headline, excerpt and source; the full story opens in an in-app browser. */
export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { saved, isSaved, toggle } = useBookmarks();
  const [article, setArticle] = useState<FeedArticle | null>(
    () => knownArticle(id) ?? saved.find((a) => a.id === id) ?? null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (article || !id) return;
    newsApi
      .getArticle(id)
      .then(setArticle)
      .catch(() => setFailed(true));
  }, [article, id]);

  if (!article) {
    return (
      <View style={styles.center}>
        {failed ? <Text style={styles.muted}>{"This story isn't available offline."}</Text> : <ActivityIndicator color={colors.gold} />}
      </View>
    );
  }

  const bookmarked = isSaved(article.id);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.meta}>
        {article.source.toUpperCase()} · {new Date(article.publishedAt).toLocaleString()}
      </Text>
      <Text style={styles.title}>{article.title}</Text>
      {!!article.excerpt && article.excerpt !== article.title && <Text style={styles.body}>{article.excerpt}</Text>}
      <View style={styles.actions}>
        <Pressable
          onPress={() => toggle(article)}
          style={[styles.button, bookmarked && styles.buttonActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: bookmarked }}
        >
          <Text style={styles.buttonText}>{bookmarked ? 'Saved' : 'Save'}</Text>
        </Pressable>
        {article.url && (
          <Pressable
            onPress={() => void WebBrowser.openBrowserAsync(article.url!)}
            style={styles.button}
            accessibilityRole="link"
          >
            <Text style={styles.buttonText}>Open original</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  muted: { color: colors.muted },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  meta: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: colors.gold },
  title: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 32, fontWeight: '900', color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  button: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  buttonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  buttonText: { color: colors.ink, fontWeight: '600' },
});
