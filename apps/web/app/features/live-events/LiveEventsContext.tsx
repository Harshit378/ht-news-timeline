'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { getLiveEvents, wsUrl } from '@/app/lib/api-client';
import { LiveEventTimeline } from './types';
import { applyUpdate, isUpdatePayload, parseMessage } from './liveEvents';
import { useWebSocket } from './useWebSocket';

/** Last good event list, shown while offline or until the API answers (ADR-005 fallback). */
const CACHE_KEY = 'ht_timeline_live_v1';

interface LiveEventsContextType {
  timelines: LiveEventTimeline[];
  loading: boolean;
  /** True when the list on screen came from the local cache because the API was unreachable. */
  fromCache: boolean;
  /** Ids of updates that arrived over the socket in this session (for highlighting). */
  freshIds: Set<string>;
  refresh: () => Promise<void>;
  receive: (raw: string) => void;
}

const LiveEventsContext = createContext<LiveEventsContextType | undefined>(undefined);

function readCache(): LiveEventTimeline[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as LiveEventTimeline[]) : [];
  } catch {
    return [];
  }
}

function writeCache(timelines: LiveEventTimeline[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(timelines));
  } catch {
    // Storage full or unavailable — non-fatal.
  }
}

export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const [timelines, setTimelines] = useState<LiveEventTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(async () => {
    try {
      const list = await getLiveEvents();
      setTimelines(list);
      setFromCache(false);
    } catch {
      const cached = readCache();
      if (cached.length) {
        setTimelines((current) => (current.length ? current : cached));
        setFromCache(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = readCache();
    if (cached.length) setTimelines(cached);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!loading && !fromCache) writeCache(timelines);
  }, [timelines, loading, fromCache]);

  const timelinesRef = useRef(timelines);
  timelinesRef.current = timelines;

  const receive = useCallback(
    (raw: string) => {
      const msg = parseMessage(raw);
      if (msg?.type !== 'update' || !isUpdatePayload(msg.data)) return;
      const payload = msg.data;
      if (!timelinesRef.current.some((t) => t.id === payload.eventId)) {
        void refresh();
        return;
      }
      setTimelines((current) => applyUpdate(current, payload).timelines);
      setFreshIds((ids) => new Set(ids).add(payload.update.id));
    },
    [refresh],
  );

  const value: LiveEventsContextType = { timelines, loading, fromCache, freshIds, refresh, receive };
  return <LiveEventsContext.Provider value={value}>{children}</LiveEventsContext.Provider>;
}

export function useLiveEvents() {
  const ctx = useContext(LiveEventsContext);
  if (!ctx) throw new Error('useLiveEvents must be used within LiveEventsProvider');
  return ctx;
}

/**
 * Opens the live socket while the calling component is mounted (only /live needs it).
 * Every (re)open refetches the list, so updates missed while disconnected show up.
 */
export function useLiveConnection() {
  const { receive, refresh } = useLiveEvents();
  const onOpen = useCallback(() => void refresh(), [refresh]);
  return useWebSocket(wsUrl(), { onMessage: receive, onOpen });
}
