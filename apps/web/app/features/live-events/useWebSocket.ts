'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { reconnectDelay } from './backoff';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'offline';

interface UseWebSocketOptions {
  /** First retry delay; later retries double it (ADR-005). */
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  /** Called with each raw message string. Kept in a ref, so changing it doesn't reconnect. */
  onMessage?: (data: string) => void;
  /** Called on every successful open, including reconnects (use it to resync missed state). */
  onOpen?: () => void;
  /** Set false to stay disconnected. */
  enabled?: boolean;
}

/**
 * WebSocket with capped exponential backoff: up to `maxReconnectAttempts` retries (~1, 2, 4, 8, 16 s),
 * then `offline` until `reconnect()`, the browser's `online` event, or the page becoming visible again.
 */
export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const { reconnectInterval = 1000, maxReconnectAttempts = 5, enabled = true } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const closedByUserRef = useRef(false);
  const onMessageRef = useRef(options.onMessage);
  const onOpenRef = useRef(options.onOpen);
  onMessageRef.current = options.onMessage;
  onOpenRef.current = options.onOpen;

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    clearTimer();
    closedByUserRef.current = false;
    setStatus(attemptRef.current === 0 ? 'connecting' : 'reconnecting');

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setStatus('offline');
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      setAttempt(0);
      setError(null);
      setStatus('open');
      onOpenRef.current?.();
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') onMessageRef.current?.(event.data);
    };

    ws.onerror = () => setError('WebSocket error');

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      if (closedByUserRef.current) return;
      if (attemptRef.current >= maxReconnectAttempts) {
        setStatus('offline');
        return;
      }
      const delay = reconnectDelay(attemptRef.current, { baseMs: reconnectInterval });
      attemptRef.current += 1;
      setAttempt(attemptRef.current);
      setStatus('reconnecting');
      timerRef.current = setTimeout(connect, delay);
    };
  }, [url, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    clearTimer();
    closedByUserRef.current = true;
    const ws = wsRef.current;
    wsRef.current = null;
    ws?.close();
  }, []);

  /** Start over with a fresh retry budget (manual Retry button, network back, tab visible). */
  const reconnect = useCallback(() => {
    disconnect();
    attemptRef.current = 0;
    setAttempt(0);
    connect();
  }, [connect, disconnect]);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return disconnect;
  }, [enabled, connect, disconnect]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const wakeUp = () => {
      if (document.visibilityState === 'visible' && !wsRef.current) reconnect();
    };
    window.addEventListener('online', wakeUp);
    document.addEventListener('visibilitychange', wakeUp);
    return () => {
      window.removeEventListener('online', wakeUp);
      document.removeEventListener('visibilitychange', wakeUp);
    };
  }, [enabled, reconnect]);

  const send = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return {
    status,
    isConnected: status === 'open',
    attempt,
    maxAttempts: maxReconnectAttempts,
    error,
    send,
    reconnect,
  };
}
