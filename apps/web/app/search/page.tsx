'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Clock, Search, X } from 'lucide-react';
import PageHeader from '@/app/components/shell/PageHeader';
import NewsCard from '@/app/components/timeline/NewsCard';
import { useFeed } from '@/app/contexts/FeedContext';
import { useNews } from '@/app/contexts/NewsContext';
import { getTrending, searchArticles, type TrendingTopic } from '@/app/lib/api-client';
import { categoryName } from '@/app/lib/category-style';
import { clearRecentSearches, getRecentSearches } from '@/app/lib/recent-searches';
import { storyHref } from '@/app/lib/story-query';
import type { FeedArticle } from '@/app/types/article';

const SUGGESTIONS = ['Artificial intelligence regulation', 'Climate summit', 'Federal Reserve rates', 'Mars mission'];

const CHIP =
  'flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border border-border px-4 text-sm text-ink active:bg-surface-alt';

export default function SearchPage() {
  const router = useRouter();
  const { rememberArticles } = useFeed();
  const { pinnedItems } = useNews();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<FeedArticle[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [trending, setTrending] = useState<TrendingTopic[]>([]);

  useEffect(() => {
    setRecent(getRecentSearches());
    getTrending()
      .then(setTrending)
      .catch(() => setTrending([]));
  }, []);

  // Live results from already-ingested coverage, debounced 300ms.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(() => {
      searchArticles(term)
        .then((items) => {
          setResults(items.slice(0, 10));
          rememberArticles(items);
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, rememberArticles]);

  const goToStory = (term: string, category?: string) => {
    const t = term.trim();
    if (!t) return;
    inputRef.current?.blur();
    router.push(storyHref(t, category));
  };

  const pinnedStories = pinnedItems.filter((p) => p.type === 'search');

  return (
    <>
      <PageHeader kicker="Follow any story" title="Search">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            goToStory(q);
          }}
          className="flex items-center gap-2 rounded-[10px] border border-border bg-surface-alt px-3 focus-within:border-accent"
        >
          <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="An event, person, place…"
            aria-label="Search stories"
            className="min-h-[48px] min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="flex h-10 w-10 items-center justify-center text-muted"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
      </PageHeader>

      <main className="px-4 py-4">
        {q.trim() ? (
          <>
            <button
              type="button"
              onClick={() => goToStory(q)}
              className="mb-4 flex min-h-[56px] w-full items-center gap-3 rounded-[10px] bg-accent px-4 text-left text-white"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-white/80">
                  Full timeline
                </span>
                <span className="block truncate font-serif text-lg font-bold">“{q.trim()}” from the beginning</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0" />
            </button>

            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-gold">
              {searching ? 'Searching latest coverage…' : `Latest coverage · ${results.length}`}
            </h2>
            <ul className="flex flex-col gap-3">
              {results.map((a) => (
                <li key={a.id}>
                  <NewsCard article={a} stamp="date" />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex flex-col gap-7">
            {pinnedStories.length > 0 && (
              <section>
                <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Pinned stories</h2>
                <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                  {pinnedStories.map((p) => (
                    <Link key={p.id} href={storyHref(p.title)} className={CHIP}>
                      {p.title}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {recent.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Recent</h2>
                  <button
                    type="button"
                    onClick={() => {
                      clearRecentSearches();
                      setRecent([]);
                    }}
                    className="min-h-[36px] text-xs font-semibold text-muted"
                  >
                    Clear
                  </button>
                </div>
                <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                  {recent.map((term) => (
                    <button key={term} type="button" onClick={() => goToStory(term)} className={CHIP}>
                      <Clock className="h-3.5 w-3.5 text-muted" />
                      {term}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {trending.length > 0 && (
              <section>
                <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Trending now</h2>
                <ol className="grid grid-cols-2 gap-2">
                  {trending.map((t) => (
                    <li key={t.topic}>
                      <button
                        type="button"
                        onClick={() => goToStory(categoryName(t.topic), t.topic)}
                        className="flex min-h-[56px] w-full items-center gap-3 rounded-[10px] border border-border bg-surface-alt px-3 text-left active:bg-surface"
                      >
                        <span className="font-mono text-sm text-accent">{String(t.rank).padStart(2, '0')}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{categoryName(t.topic)}</span>
                          <span className="block font-mono text-[10px] text-muted">{t.count} articles</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section>
              <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Try</h2>
              <ul className="flex flex-col divide-y divide-border rounded-[10px] border border-border">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => goToStory(s)}
                      className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left text-sm text-ink active:bg-surface-alt"
                    >
                      <Search className="h-4 w-4 text-muted" />
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </main>
    </>
  );
}
