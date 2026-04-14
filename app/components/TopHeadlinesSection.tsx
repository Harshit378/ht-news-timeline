'use client';

import { useNews } from '@/app/contexts/NewsContext';
import { useTopHeadlines } from '@/app/hooks/useNewsOrgArticles';
import Timeline from '@/app/components/Timeline';

function getCountryLabel(code: string) {
  return code.toUpperCase();
}

export default function TopHeadlinesSection() {
  const { selectedCountry } = useNews();
  const { articles, loading, error } = useTopHeadlines(selectedCountry);

  return (
    <section className="max-w-6xl mx-auto mb-20 px-4 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-blue-600 dark:text-blue-400 font-semibold">
            Top headlines
          </p>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
            Trending news in {getCountryLabel(selectedCountry)}
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400 max-w-2xl">
            The latest top stories from your saved country, refreshed automatically when the selection changes.
          </p>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-slate-50 dark:bg-slate-800 p-10 text-center text-slate-500 dark:text-slate-400">
            Loading top headlines...
          </div>
        ) : error ? (
          <div className="rounded-3xl bg-red-50 dark:bg-red-900/20 p-10 text-center text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : articles.length > 0 ? (
          <Timeline events={articles} />
        ) : (
          <div className="rounded-3xl bg-slate-50 dark:bg-slate-800 p-10 text-center text-slate-600 dark:text-slate-400">
            No headlines available for {getCountryLabel(selectedCountry)}.
          </div>
        )}
      </div>
    </section>
  );
}
