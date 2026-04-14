'use client';

import { useEverythingSearch } from '@/app/hooks/useNewsOrgArticles';
import Timeline from '@/app/components/Timeline';

interface SearchTimelineProps {
  query: string;
}

export default function SearchTimeline({ query }: SearchTimelineProps) {
  const { articles, loading, error } = useEverythingSearch(query);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-blue-600 dark:text-blue-400 font-semibold">
          Search results
        </p>
        <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
          News for “{query}”
        </h2>
        <p className="mt-3 text-slate-600 dark:text-slate-400 max-w-2xl">
          Latest articles from the NewsOrg Everything API, displayed in timeline format.
        </p>
      </div>

      {loading ? (
        <div className="rounded-3xl bg-slate-50 dark:bg-slate-800 p-10 text-center text-slate-500 dark:text-slate-400">
          Searching news articles...
        </div>
      ) : error ? (
        <div className="rounded-3xl bg-red-50 dark:bg-red-900/20 p-10 text-center text-red-700 dark:text-red-200">
          {error}
        </div>
      ) : articles.length > 0 ? (
        <Timeline events={articles} />
      ) : (
        <div className="rounded-3xl bg-slate-50 dark:bg-slate-800 p-10 text-center text-slate-600 dark:text-slate-400">
          No articles found for “{query}”. Try a different keyword.
        </div>
      )}
    </div>
  );
}
