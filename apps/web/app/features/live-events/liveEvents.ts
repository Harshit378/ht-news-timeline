import type { EventUpdate, LiveEventTimeline, LiveUpdatePayload } from './types';

export interface SocketMessage {
  type: 'update' | 'ping' | 'error';
  data: unknown;
  timestamp: string;
}

const TYPES = new Set(['update', 'ping', 'error']);

/** Parses a raw socket frame; null for anything that isn't a `{ type, data, timestamp }` envelope. */
export function parseMessage(raw: string): SocketMessage | null {
  try {
    const msg = JSON.parse(raw) as Partial<SocketMessage> | null;
    if (!msg || typeof msg !== 'object' || !TYPES.has(msg.type as string)) return null;
    return { type: msg.type as SocketMessage['type'], data: msg.data, timestamp: String(msg.timestamp ?? '') };
  } catch {
    return null;
  }
}

export function isUpdatePayload(data: unknown): data is LiveUpdatePayload {
  const d = data as LiveUpdatePayload | null;
  return (
    !!d &&
    typeof d.eventId === 'string' &&
    !!d.update &&
    typeof d.update.id === 'string' &&
    typeof d.update.message === 'string'
  );
}

function byNewest(a: EventUpdate, b: EventUpdate) {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

/**
 * Applies a pushed update. Duplicates (same update id, e.g. after a resync) are ignored.
 * `known: false` means the event isn't loaded yet, so the caller should refetch the list.
 */
export function applyUpdate(
  timelines: LiveEventTimeline[],
  payload: LiveUpdatePayload,
): { timelines: LiveEventTimeline[]; known: boolean } {
  const index = timelines.findIndex((t) => t.id === payload.eventId);
  if (index < 0) return { timelines, known: false };
  const current = timelines[index];
  const duplicate = current.updates.some((u) => u.id === payload.update.id);
  const status = payload.status ?? current.status;
  if (duplicate && status === current.status) return { timelines, known: true };
  const next: LiveEventTimeline = duplicate
    ? { ...current, status }
    : {
        ...current,
        status,
        updates: [payload.update, ...current.updates].sort(byNewest),
        lastUpdated: payload.update.timestamp || new Date().toISOString(),
      };
  return { timelines: timelines.map((t, i) => (i === index ? next : t)), known: true };
}
