'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, Pin } from 'lucide-react';
import PageHeader from '@/app/components/shell/PageHeader';
import EmptyState from '@/app/components/shell/EmptyState';
import StoryBrief from '@/app/components/timeline/StoryBrief';
import TimelineList from '@/app/components/timeline/TimelineList';
import TimelineSkeleton from '@/app/components/timeline/TimelineSkeleton';
import { useFeed } from '@/app/contexts/FeedContext';
import { useNews } from '@/app/contexts/NewsContext';
import { getStoryTimeline, isOfflineError } from '@/app/lib/api-client';
import { buildFeedArticles } from '@/app/lib/feed-data';
import { addRecentSearch } from '@/app/lib/recent-searches';
import { groupByPeriod, pickGranularity } from '@/app/lib/timeline-grouping';
import type { FeedArticle } from '@/app/types/article';

function formatLong(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Offline fallback: match the query against whatever articles this device already has. */
function localMatches(q: string, pool: FeedArticle[]) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  return pool.filter((a) => {
    const hay = `${a.title} ${a.excerpt} ${a.tags.join(' ')}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

/**
 * The core product view: everything known about a story, from its first report to now.
 * Reads oldest → newest; buckets by day, or by month once the story spans > ~6 weeks.
 */
export default function StoryTimeline({ query, category }: { query: string; category?: string }) {
  const { rememberArticles, articles: feedArticles, savedArticles } = useFeed();
  const { togglePinnedItem, isPinnedItem } = useNews();
  const [items, setItems] = useState<FeedArticle[]>([]);
  // offline = API unreachable; degraded = API up but global sources (GDELT) failed → partial results
  const [status, setStatus] = useState<'loading' | 'ready' | 'offline' | 'degraded' | 'error'>('loading');
  const [errorBody, setErrorBody] = useState('Check your connection and try again.');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!query) return;
    addRecentSearch(query);
    const controller = new AbortController();
    setStatus('loading');
    getStoryTimeline(query, category, controller.signal)
      .then((res) => {
        setItems(res.items);
        rememberArticles(res.items);
        if (!res.degraded) setStatus('ready');
        else if (res.items.length > 0) setStatus('degraded');
        else {
          setErrorBody('Global news sources are busy right now. Try again in a minute.');
          setStatus('error');
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const pool = new Map<string, FeedArticle>();
        for (const a of [...feedArticles, ...savedArticles, ...buildFeedArticles()]) pool.set(a.id, a);
        const local = localMatches(query, [...pool.values()]);
        setItems(local);
        rememberArticles(local);
        const offline = isOfflineError(err);
        setErrorBody(
          offline
            ? 'Check your connection and try again.'
            : 'Global news sources are busy right now. Try again in a minute.'
        );
        setStatus(local.length === 0 ? 'error' : offline ? 'offline' : 'degraded');
        console.warn('[story] timeline fetch failed', err);
      });
    return () => controller.abort();
    // feed/saved pools are only a fallback; don't refetch when they change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category, attempt, rememberArticles]);

  const granularity = useMemo(() => pickGranularity(items), [items]);
  const groups = useMemo(() => groupByPeriod(items, granularity, 'asc'), [items, granularity]);
  const sources = useMemo(() => new Set(items.map((a) => a.source)).size, [items]);
  const first = groups[0]?.items[0];

  const pinned = isPinnedItem('search', query);
  const pinButton = (
    <button
      type="button"
      onClick={() => togglePinnedItem({ type: 'search', id: query, title: query, category: category ?? 'Story' })}
      className={`-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md active:bg-surface-alt ${
        pinned ? 'text-gold' : 'text-muted'
      }`}
      aria-label={pinned ? 'Unpin story' : 'Pin story'}
      aria-pressed={pinned}
    >
      <Pin className={`h-5 w-5 ${pinned ? 'fill-current' : ''}`} />
    </button>
  );

  const jumpToLatest = useCallback(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }, []);

  const subtitle =
    status === 'loading'
      ? 'Tracing the story back to its first report…'
      : first
        ? `Started ${formatLong(first.publishedAt)} · ${items.length} reports · ${sources} sources`
        : undefined;

  return (
    <>
      <PageHeader kicker="Story timeline" title={query} subtitle={subtitle} action={pinButton} />

      {(status === 'offline' || status === 'degraded') && (
        <p className="mx-4 mt-3 flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 font-mono text-[11px] text-muted">
          <span className="flex-1">
            {status === 'offline'
              ? 'Offline — showing matches saved on this device only.'
              : 'Global sources are busy — showing partial coverage.'}
          </span>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="min-h-[32px] font-semibold text-gold">
            Retry
          </button>
        </p>
      )}

      <main className="pt-3">
        {status === 'loading' ? (
          <TimelineSkeleton />
        ) : status === 'error' ? (
          <EmptyState title="Couldn't reach the newsroom" body={errorBody}>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="min-h-[44px] rounded-full bg-accent px-5 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </EmptyState>
        ) : items.length === 0 ? (
          <EmptyState
            title="No coverage found"
            body="Try fewer or broader keywords — e.g. a person, place or event name."
          />
        ) : (
          <>
            {/* Only after the timeline loaded: that request is what starts writing the brief. */}
            {status !== 'offline' && <StoryBrief query={query} category={category} />}
            <TimelineList groups={groups} stamp="date" />
            <p className="px-4 pb-6 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
              — Latest as of {formatLong(new Date().toISOString())} —
            </p>
          </>
        )}
      </main>

      {items.length > 6 && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="fixed right-[max(1rem,calc(50vw-15rem))] bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 flex min-h-[44px] items-center gap-2 rounded-full border border-border bg-surface px-4 text-xs font-semibold uppercase tracking-wide text-ink shadow-lg"
        >
          <ArrowDownToLine className="h-4 w-4 text-accent" />
          Latest
        </button>
      )}
    </>
  );
}
