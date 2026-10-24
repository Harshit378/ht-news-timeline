import { describe, expect, it } from 'vitest';
import { reconnectDelay } from '../app/features/live-events/backoff';
import { applyUpdate, isUpdatePayload, parseMessage } from '../app/features/live-events/liveEvents';
import type { EventUpdate, LiveEventTimeline } from '../app/features/live-events/types';
import { wsUrl } from '../app/lib/api-client';

describe('reconnectDelay', () => {
  const mid = () => 0.5; // no jitter

  it('doubles from the base delay', () => {
    expect([0, 1, 2, 3, 4].map((a) => reconnectDelay(a, { random: mid }))).toEqual([1000, 2000, 4000, 8000, 16000]);
  });

  it('is capped at maxMs', () => {
    expect(reconnectDelay(10, { random: mid })).toBe(30_000);
    expect(reconnectDelay(10, { random: () => 1 })).toBe(30_000);
  });

  it('keeps jitter within ±20%', () => {
    expect(reconnectDelay(2, { random: () => 0 })).toBe(3200);
    expect(reconnectDelay(2, { random: () => 0.999999 })).toBe(4800);
  });
});

function update(id: string, iso: string, message = id): EventUpdate {
  return { id, eventId: 'e1', timestamp: iso, message, importance: 'normal', sources: [] };
}

function timeline(updates: EventUpdate[] = []): LiveEventTimeline {
  return {
    id: 'e1',
    name: 'Election',
    slug: 'election',
    description: '',
    category: 'election',
    status: 'scheduled',
    startDate: '2026-10-24T00:00:00Z',
    lastUpdated: '2026-10-24T00:00:00Z',
    updates,
  };
}

describe('applyUpdate', () => {
  it('adds a new update newest first and takes the pushed status', () => {
    const list = [timeline([update('u1', '2026-10-24T10:00:00Z')])];
    const { timelines, known } = applyUpdate(list, {
      eventId: 'e1',
      update: update('u2', '2026-10-24T11:00:00Z'),
      status: 'ongoing',
    });
    expect(known).toBe(true);
    expect(timelines[0].updates.map((u) => u.id)).toEqual(['u2', 'u1']);
    expect(timelines[0].status).toBe('ongoing');
    expect(timelines[0].lastUpdated).toBe('2026-10-24T11:00:00Z');
  });

  it('ignores an update it already has (e.g. after a resync)', () => {
    const list = [timeline([update('u1', '2026-10-24T10:00:00Z')])];
    const result = applyUpdate(list, { eventId: 'e1', update: update('u1', '2026-10-24T10:00:00Z') });
    expect(result.timelines).toBe(list);
  });

  it('reports unknown events so the caller can refetch', () => {
    const list = [timeline()];
    const result = applyUpdate(list, { eventId: 'nope', update: update('u1', '2026-10-24T10:00:00Z') });
    expect(result).toEqual({ timelines: list, known: false });
  });
});

describe('parseMessage / isUpdatePayload', () => {
  it('accepts the gateway envelope', () => {
    const raw = JSON.stringify({ type: 'update', data: { eventId: 'e1', update: update('u1', 'x') }, timestamp: 't' });
    const msg = parseMessage(raw);
    expect(msg?.type).toBe('update');
    expect(isUpdatePayload(msg?.data)).toBe(true);
  });

  it('rejects junk', () => {
    expect(parseMessage('not json')).toBeNull();
    expect(parseMessage('null')).toBeNull();
    expect(parseMessage(JSON.stringify({ type: 'hack', data: 1 }))).toBeNull();
    expect(isUpdatePayload({ eventId: 'e1' })).toBe(false);
  });
});

describe('wsUrl', () => {
  it('derives the socket URL from the API base', () => {
    expect(wsUrl('http://localhost:4000/api', '')).toBe('ws://localhost:4000/ws/events');
    expect(wsUrl('https://api.example.com/api/', '')).toBe('wss://api.example.com/ws/events');
  });

  it('prefers an explicit override', () => {
    expect(wsUrl('http://localhost:4000/api', 'wss://live.example.com/ws/events')).toBe('wss://live.example.com/ws/events');
  });
});
