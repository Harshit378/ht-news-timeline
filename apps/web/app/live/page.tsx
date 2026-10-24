'use client';

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import PageHeader from '@/app/components/shell/PageHeader';
import EmptyState from '@/app/components/shell/EmptyState';
import LiveEventTimelineComponent from '@/app/features/live-events/LiveEventTimeline';
import { useLiveConnection, useLiveEvents } from '@/app/features/live-events/LiveEventsContext';
import type { ConnectionStatus } from '@/app/features/live-events/useWebSocket';
import { useHydrated } from '@/app/hooks/useHydrated';

const STATUS_DOT: Record<string, string> = {
  ongoing: 'bg-accent animate-[pulse-dot_1.5s_ease-in-out_infinite]',
  scheduled: 'bg-gold',
  completed: 'bg-dim',
};

function ConnectionBadge({
  status,
  attempt,
  maxAttempts,
  fromCache,
  onRetry,
}: {
  status: ConnectionStatus;
  attempt: number;
  maxAttempts: number;
  fromCache: boolean;
  onRetry: () => void;
}) {
  const label =
    status === 'open'
      ? 'Live'
      : status === 'connecting'
        ? 'Connecting…'
        : status === 'reconnecting'
          ? `Reconnecting… (${attempt}/${maxAttempts})`
          : fromCache
            ? 'Offline · showing saved updates'
            : 'Offline';
  const dot =
    status === 'open' ? 'bg-accent animate-[pulse-dot_1.5s_ease-in-out_infinite]' : status === 'offline' ? 'bg-dim' : 'bg-gold';
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted" role="status">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span>{label}</span>
      {status === 'offline' && (
        <button
          type="button"
          onClick={onRetry}
          className="-my-2 flex h-11 items-center rounded-md px-2 text-accent active:bg-surface-alt"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export default function LivePage() {
  const { timelines, loading, fromCache, freshIds } = useLiveEvents();
  const connection = useLiveConnection();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hydrated = useHydrated();
  const selected = timelines.find((t) => t.id === selectedId) ?? null;

  const badge = (
    <ConnectionBadge
      status={connection.status}
      attempt={connection.attempt}
      maxAttempts={connection.maxAttempts}
      fromCache={fromCache}
      onRetry={connection.reconnect}
    />
  );

  if (selected) {
    return (
      <>
        <PageHeader
          kicker="Live event"
          title={selected.name}
          action={
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="-mr-2 flex h-11 items-center gap-1 rounded-md px-2 text-sm text-muted active:bg-surface-alt"
            >
              <ChevronLeft className="h-4 w-4" />
              All
            </button>
          }
        />
        <div className="px-4 pt-2">{badge}</div>
        <main className="py-3">
          <LiveEventTimelineComponent timeline={selected} freshIds={freshIds} />
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader kicker="As it happens" title="Live" subtitle="Moment-by-moment timelines for developing events." />
      <div className="px-4 pt-2">{badge}</div>
      {timelines.length === 0 ? (
        loading ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Loading live events…</p>
        ) : (
          <EmptyState
            title="No live events right now"
            body={connection.status === 'offline' ? "Couldn't reach the newsroom." : undefined}
          />
        )
      ) : (
        <ul className="flex flex-col gap-3 px-4 py-4">
          {timelines.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setSelectedId(t.id)}
                className="w-full rounded-[10px] border border-border bg-surface-alt p-4 text-left active:bg-surface"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[t.status] ?? 'bg-dim'}`} />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    {t.status} · {t.category}
                  </span>
                </div>
                <h2 className="font-serif text-lg font-bold leading-snug text-ink">{t.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{t.description}</p>
                <p className="mt-2 font-mono text-[10px] text-gold">
                  {t.updates.length} {t.updates.length === 1 ? 'update' : 'updates'}
                  {hydrated && ` · last ${new Date(t.lastUpdated).toLocaleString()}`}
                </p>
                {t.updates[0] && <p className="mt-2 line-clamp-1 text-xs text-muted">{t.updates[0].message}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
