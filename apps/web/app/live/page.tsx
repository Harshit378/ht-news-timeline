'use client';

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import PageHeader from '@/app/components/shell/PageHeader';
import EmptyState from '@/app/components/shell/EmptyState';
import LiveEventTimelineComponent from '@/app/features/live-events/LiveEventTimeline';
import { useLiveEvents } from '@/app/features/live-events/LiveEventsContext';
import { useHydrated } from '@/app/hooks/useHydrated';

const STATUS_DOT: Record<string, string> = {
  ongoing: 'bg-accent animate-[pulse-dot_1.5s_ease-in-out_infinite]',
  scheduled: 'bg-gold',
  completed: 'bg-dim',
};

export default function LivePage() {
  const { timelines } = useLiveEvents();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hydrated = useHydrated();
  const selected = timelines.find((t) => t.id === selectedId) ?? null;

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
        <main className="py-2">
          <LiveEventTimelineComponent timeline={selected} />
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader kicker="As it happens" title="Live" subtitle="Moment-by-moment timelines for developing events." />
      {timelines.length === 0 ? (
        <EmptyState title="No live events right now" />
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
                  {t.events.length} updates
                  {hydrated && ` · last ${new Date(t.lastUpdated).toLocaleString()}`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
