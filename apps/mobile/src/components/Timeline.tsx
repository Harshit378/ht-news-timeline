import type { ReactElement } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import type { FeedArticle } from '@ht/shared/article';
import type { TimelineGroup } from '@ht/shared/timeline-grouping';
import { colors, fonts } from '@/theme';
import { ArticleRow } from './ArticleRow';

/**
 * Date-grouped timeline on a native SectionList (ADR-001 Path B): virtualized rows and sticky day headers,
 * from the same `groupByPeriod` the web app uses.
 */
export function Timeline({
  groups,
  stamp = 'time',
  refreshing = false,
  onRefresh,
  onEndReached,
  header,
  footer,
}: {
  groups: TimelineGroup<FeedArticle>[];
  stamp?: 'time' | 'date';
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  header?: ReactElement;
  footer?: ReactElement;
}) {
  return (
    <SectionList
      sections={groups.map((g) => ({ key: g.key, title: g.label, data: g.items }))}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => <ArticleRow article={item} stamp={stamp} />}
      renderSectionHeader={({ section }) => (
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {section.title.toUpperCase()} <Text style={styles.count}>· {section.data.length}</Text>
          </Text>
        </View>
      )}
      stickySectionHeadersEnabled
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} /> : undefined
      }
      style={styles.list}
      contentContainerStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 32 },
  header: { backgroundColor: colors.bg, paddingHorizontal: 16, paddingVertical: 8 },
  headerText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: colors.gold },
  count: { color: colors.muted },
});
