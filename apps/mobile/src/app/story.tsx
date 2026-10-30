import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { FeedArticle } from '@ht/shared/article';
import { isOfflineError, type StoryBrief } from '@ht/shared/news-api';
import { groupByPeriod, pickGranularity } from '@ht/shared/timeline-grouping';
import { Timeline } from '@/components/Timeline';
import { newsApi } from '@/lib/api';
import { rememberArticles } from '@/lib/articles';
import { colors, fonts } from '@/theme';

/** A story from its first report to now, oldest first, with the AI brief when it's ready (ADR-004). */
export default function StoryScreen() {
  const { q = '' } = useLocalSearchParams<{ q: string }>();
  const [items, setItems] = useState<FeedArticle[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'degraded' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [brief, setBrief] = useState<StoryBrief | null>(null);

  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    setStatus('loading');
    newsApi
      .getStoryTimeline(q, undefined, controller.signal)
      .then((res) => {
        setItems(res.items);
        rememberArticles(res.items);
        setStatus(res.degraded ? 'degraded' : 'ready');
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setMessage(isOfflineError(err) ? 'You are offline.' : 'Global news sources are busy. Try again shortly.');
        setStatus('error');
      });
    return () => controller.abort();
  }, [q]);

  // The brief is written in the background after the timeline loads; poll a few times.
  useEffect(() => {
    if (status !== 'ready' && status !== 'degraded') return;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = () =>
      newsApi
        .getStoryBrief(q, undefined, controller.signal)
        .then((res) => {
          if (res.status === 'ready' && res.brief) setBrief(res.brief);
          else if (res.status === 'pending' && ++polls < 20) timer = setTimeout(poll, 3000);
        })
        .catch(() => undefined);
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [q, status]);

  const groups = useMemo(() => groupByPeriod(items, pickGranularity(items), 'asc'), [items]);
  const reports = items.filter((a) => a.kind !== 'milestone');
  const sources = new Set(reports.map((a) => a.source)).size;

  return (
    <>
      <Stack.Screen options={{ title: q }} />
      {status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : status === 'error' && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{message}</Text>
        </View>
      ) : (
        <Timeline
          groups={groups}
          stamp="date"
          header={
            <View style={styles.headerBox}>
              <Text style={styles.meta}>
                {reports.length} REPORTS · {sources} SOURCES
                {items.length > reports.length ? ` · ${items.length - reports.length} MILESTONES` : ''}
              </Text>
              {status === 'degraded' && <Text style={styles.muted}>Some sources are busy — coverage is partial.</Text>}
              {brief && (
                <View style={styles.brief}>
                  <Text style={styles.briefKicker}>WHAT HAPPENED</Text>
                  <Text style={styles.briefText}>{brief.summary}</Text>
                  {brief.keyPoints.map((p) => (
                    <Text key={p} style={styles.point}>
                      • {p}
                    </Text>
                  ))}
                  <Text style={styles.briefFoot}>
                    AI summary of {brief.articleCount} reports · may contain errors
                  </Text>
                </View>
              )}
            </View>
          }
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  muted: { color: colors.muted, fontSize: 13 },
  headerBox: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8 },
  meta: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: colors.muted },
  brief: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 14, gap: 6 },
  briefKicker: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: colors.gold },
  briefText: { fontFamily: fonts.serif, fontSize: 15, lineHeight: 22, color: colors.ink },
  point: { fontSize: 14, lineHeight: 20, color: colors.ink },
  briefFoot: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted, marginTop: 4 },
});
