import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { FeedArticle } from '@ht/shared/article';
import { CATEGORY_EMOJI } from '@ht/shared/article';
import { colors, fonts } from '@/theme';

function time(iso: string, stamp: 'time' | 'date') {
  const d = new Date(iso);
  return stamp === 'time'
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** One report on the timeline rail; Wikipedia milestones (ADR-008) get the gold diamond. */
export function ArticleRow({ article, stamp = 'time' }: { article: FeedArticle; stamp?: 'time' | 'date' }) {
  const milestone = article.kind === 'milestone';
  const sponsored = article.kind === 'sponsored';
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/article/[id]', params: { id: article.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={article.title}
    >
      <View style={styles.rail}>
        <View
          style={[
            styles.dot,
            milestone && styles.diamond,
            sponsored && styles.sponsoredDot,
            article.isBreaking && styles.breaking,
          ]}
        />
      </View>
      <View style={[styles.card, milestone && styles.milestoneCard, sponsored && styles.sponsoredCard]}>
        <Text style={[styles.meta, sponsored && styles.sponsoredMeta]}>
          {milestone
            ? 'MILESTONE · WIKIPEDIA'
            : sponsored
              ? 'SPONSORED'
              : `${time(article.publishedAt, stamp)} · ${article.source.toUpperCase()}`}
          {!milestone && !sponsored && article.category ? `  ${CATEGORY_EMOJI[article.category] ?? ''}` : ''}
        </Text>
        <Text style={milestone ? styles.milestoneText : styles.title} numberOfLines={milestone ? 4 : 3}>
          {article.title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  pressed: { opacity: 0.7 },
  rail: { width: 14, alignItems: 'center', paddingTop: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.dim },
  diamond: { borderRadius: 0, backgroundColor: colors.gold, transform: [{ rotate: '45deg' }] },
  sponsoredDot: { backgroundColor: colors.gold, borderRadius: 2 },
  breaking: { backgroundColor: colors.accent },
  card: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
  },
  milestoneCard: { backgroundColor: colors.surface, borderColor: colors.gold },
  sponsoredCard: { backgroundColor: colors.surface, borderColor: colors.gold },
  meta: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.8, color: colors.gold, marginBottom: 4 },
  sponsoredMeta: { color: colors.gold, fontWeight: '700' },
  title: { fontFamily: fonts.serif, fontSize: 17, lineHeight: 22, fontWeight: '700', color: colors.ink },
  milestoneText: { fontSize: 14, lineHeight: 20, color: colors.ink },
});
