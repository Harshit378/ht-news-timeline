import { FlatList, StyleSheet, Text, View } from 'react-native';
import { ArticleRow } from '@/components/ArticleRow';
import { useBookmarks } from '@/lib/bookmarks';
import { colors, fonts } from '@/theme';

function syncLabel(state: string, lastSyncedAt: string | null) {
  if (state === 'pending') return "SAVED ON THIS DEVICE · WILL BACK UP WHEN YOU'RE ONLINE";
  if (state === 'error') return 'SAVED ON THIS DEVICE · BACKUP FAILED';
  return lastSyncedAt ? 'SAVED ON THIS DEVICE · BACKED UP' : 'SAVED ON THIS DEVICE';
}

/** Saved stories: full snapshots in SQLite, readable offline, backed up per device (ADR-006). */
export default function SavedScreen() {
  const { saved, sync } = useBookmarks();
  return (
    <FlatList
      data={saved}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => <ArticleRow article={item} stamp="date" />}
      style={styles.list}
      ListHeaderComponent={
        saved.length > 0 ? <Text style={styles.status}>{syncLabel(sync.state, sync.lastSyncedAt)}</Text> : undefined
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No saved stories yet</Text>
          <Text style={styles.muted}>Open a story and tap Save to keep it here, even offline.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  status: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: colors.muted, padding: 16 },
  empty: { margin: 16, padding: 24, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: 'center', gap: 8 },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 18, fontWeight: '700', color: colors.ink },
  muted: { color: colors.muted, textAlign: 'center' },
});
