'use client';

import { useEffect, useMemo, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import PageHeader from '@/app/components/shell/PageHeader';
import EmptyState from '@/app/components/shell/EmptyState';
import BreakingBanner from '@/app/components/timeline/BreakingBanner';
import FilterChips from '@/app/components/timeline/FilterChips';
import TimelineList from '@/app/components/timeline/TimelineList';
import TimelineSkeleton from '@/app/components/timeline/TimelineSkeleton';
import { groupByPeriod } from '@/app/lib/timeline-grouping';
import { useFeed } from '@/app/contexts/FeedContext';
import { useHydrated } from '@/app/hooks/useHydrated';

export default function TimelineFeed() {
  const { filteredArticles, isLoading, isLoadingMore, hasMore, loadMore, refresh, source, error } = useFeed();
  const sentinel = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();

  const groups = useMemo(() => groupByPeriod(filteredArticles, 'day', 'desc'), [filteredArticles]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), {
      rootMargin: '400px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  return (
    <>
      <PageHeader
        kicker={
          hydrated
            ? new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
            : 'Today'
        }
        title="News Timeline"
        action={
          <button
            type="button"
            onClick={refresh}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-md text-muted active:bg-surface-alt"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        }
      >
        <FilterChips />
      </PageHeader>
      <BreakingBanner />

      {error && source !== 'api' && (
        <p className="mx-4 mt-3 rounded-md border border-border bg-surface px-3 py-2 font-mono text-[11px] text-muted">
          Offline — showing {source === 'cache' ? 'your last loaded feed' : 'sample stories'}.
        </p>
      )}

      <main className="pt-3">
        {isLoading ? (
          <TimelineSkeleton />
        ) : groups.length === 0 ? (
          <EmptyState title="Nothing here yet" body="No stories match these filters." />
        ) : (
          <TimelineList groups={groups} />
        )}
        <div ref={sentinel} aria-hidden />
        {isLoadingMore && <TimelineSkeleton rows={2} />}
      </main>
    </>
  );
}
