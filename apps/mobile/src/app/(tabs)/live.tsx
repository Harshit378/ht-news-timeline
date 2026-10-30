import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LiveEventTimeline } from '@ht/shared/live-events';
import { applyUpdate, isUpdatePayload, parseMessage } from '@ht/shared/live-events-reducer';
import { reconnectDelay } from '@ht/shared/backoff';
import { deriveWsUrl } from '@ht/shared/news-api';
import { API_BASE_URL, newsApi } from '@/lib/api';
import { readJson, writeJson } from '@/lib/storage';
import { colors, fonts } from '@/theme';

const LIVE_CACHE_KEY = 'ht_timeline_live_mobile_v1';
const MAX_RETRIES = 5;

type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'offline';

export default function LiveScreen() {
  const [timelines, setTimelines] = useState<LiveEventTimeline[]>(() => readJson(LIVE_CACHE_KEY, []));
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [retries, setRetries] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(timelines.length === 0);

  const socketRef = useRef<WebSocket | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await newsApi.getLiveEvents();
      setTimelines(data);
      writeJson(LIVE_CACHE_KEY, data);
    } catch {
      // Offline fallback already loaded from cache
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const connectSocket = useCallback(() => {
    if (unmountedRef.current) return;
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    const wsUrl = deriveWsUrl(API_BASE_URL);
    setStatus(retries === 0 ? 'connecting' : 'reconnecting');

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) return;
        setStatus('open');
        setRetries(0);
        void fetchEvents();
      };

      ws.onmessage = (e) => {
        if (unmountedRef.current) return;
        const msg = parseMessage(e.data);
        if (msg && msg.type === 'update') {
          const payload = msg.data;
          if (isUpdatePayload(payload)) {
            setTimelines((prev) => {
              const result = applyUpdate(prev, payload);
              if (!result.known) void fetchEvents();
              writeJson(LIVE_CACHE_KEY, result.timelines);
              return result.timelines;
            });
          }
        }
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        socketRef.current = null;
        setRetries((prev) => {
          if (prev >= MAX_RETRIES) {
            setStatus('offline');
            return prev;
          }
          const next = prev + 1;
          const delay = reconnectDelay(prev);
          retryTimerRef.current = setTimeout(() => {
            connectSocket();
          }, delay);
          setStatus('reconnecting');
          return next;
        });
      };

      ws.onerror = () => {
        // Will trigger onclose and retry
      };
    } catch {
      setStatus('offline');
    }
  }, [fetchEvents, retries]);

  useEffect(() => {
    unmountedRef.current = false;
    void fetchEvents();
    connectSocket();

    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        setRetries(0);
        connectSocket();
      } else if (nextState === 'background') {
        if (socketRef.current) {
          socketRef.current.close();
          socketRef.current = null;
        }
      }
    });

    return () => {
      unmountedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      sub.remove();
    };
  }, [connectSocket, fetchEvents]);

  if (loading && timelines.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  const allUpdates = timelines.flatMap((t) =>
    t.updates.map((u) => ({
      ...u,
      eventName: t.name,
      eventCategory: t.category,
      eventStatus: t.status,
    })),
  );

  return (
    <View style={styles.container}>
      {/* Connection status header */}
      <View style={styles.statusBar}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              status === 'open' && styles.dotOpen,
              status === 'connecting' && styles.dotPending,
              status === 'reconnecting' && styles.dotPending,
              status === 'offline' && styles.dotOffline,
            ]}
          />
          <Text style={styles.statusText}>
            {status === 'open' && 'LIVE STREAM CONNECTED'}
            {status === 'connecting' && 'CONNECTING TO LIVE STREAM...'}
            {status === 'reconnecting' && `RECONNECTING (${retries}/${MAX_RETRIES})...`}
            {status === 'offline' && 'OFFLINE · SHOWING SAVED UPDATES'}
          </Text>
        </View>
        {status === 'offline' && (
          <Pressable
            onPress={() => {
              setRetries(0);
              connectSocket();
            }}
            style={styles.retryBtn}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={allUpdates}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.gold}
            onRefresh={() => {
              setRefreshing(true);
              void fetchEvents();
            }}
          />
        }
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isCritical = item.importance === 'critical';
          const time = new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          return (
            <View style={[styles.card, isCritical && styles.cardCritical]}>
              <View style={styles.cardHeader}>
                <Text style={styles.eventLabel}>{item.eventName.toUpperCase()}</Text>
                <Text style={styles.timeLabel}>{time}</Text>
              </View>
              <Text style={styles.message}>{item.message}</Text>
              {item.sources && item.sources.length > 0 && (
                <Text style={styles.sources}>Via {item.sources.join(', ')}</Text>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No live events in progress right now.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotOpen: { backgroundColor: '#22c55e' },
  dotPending: { backgroundColor: colors.gold },
  dotOffline: { backgroundColor: colors.accent },
  statusText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.6, color: colors.ink },
  retryBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, backgroundColor: colors.border },
  retryText: { fontFamily: fonts.mono, fontSize: 11, color: colors.ink },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 14,
  },
  cardCritical: { borderColor: colors.accent, borderLeftWidth: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  eventLabel: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.8, color: colors.gold },
  timeLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted },
  message: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 22, color: colors.ink },
  sources: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted, marginTop: 8 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: colors.muted, fontSize: 14 },
});
