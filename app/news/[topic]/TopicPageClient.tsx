'use client';

import Header from '@/app/components/header';
import Timeline from '@/app/components/Timeline';
import PinnedTopics from '@/app/components/PinnedTopics';
import { PinnedItem, useNews } from '@/app/contexts/NewsContext';
import { ArrowLeft, Pin, PinOff } from 'lucide-react';
import Link from 'next/link';
import { useEverythingSearch } from '@/app/hooks/useNewsOrgArticles';

interface TopicPageClientProps {
  topicId: string;
}

export default function TopicPageClient({ topicId }: TopicPageClientProps) {
  const { allTopics, togglePinnedItem, isPinnedItem } = useNews();
  const decodedTopicId = decodeURIComponent(topicId);
  const topic = allTopics.find((t) => t.id === decodedTopicId);
  const searchQuery = topic ? topic.title : decodedTopicId;
  const { articles, loading, error } = useEverythingSearch(searchQuery);

  const pinItem: PinnedItem = topic
    ? { type: 'topic', id: topic.id, title: topic.title, category: topic.category }
    : { type: 'search', id: decodedTopicId, title: decodedTopicId, category: 'Search' };

  const isPinned = isPinnedItem(pinItem.type, pinItem.id);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Header />

      <div className="pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/news"
            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Topics</span>
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <aside className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6">
                  <button
                    onClick={() => togglePinnedItem(pinItem)}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
                      isPinned
                        ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isPinned ? (
                      <>
                        <Pin className="w-5 h-5 fill-current" />
                        Pinned
                      </>
                    ) : (
                      <>
                        <PinOff className="w-5 h-5" />
                        Pin {topic ? 'Topic' : 'Search'}
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                    📌 Pinned Topics
                  </h3>
                  <PinnedTopics />
                </div>
              </div>
            </aside>

            <div className="lg:col-span-3">
              <div className="relative h-64 md:h-80 rounded-xl overflow-hidden mb-8 shadow-lg bg-slate-200 dark:bg-slate-800">
                {topic ? (
                  <img src={topic.imageUrl} alt={topic.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center px-6 text-center">
                    <div className="max-w-xl">
                      <p className="text-sm uppercase tracking-[0.3em] text-blue-600 dark:text-blue-400 font-semibold mb-3">
                        Search query
                      </p>
                      <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                        News for "{decodedTopicId}"
                      </h1>
                      <p className="mt-3 text-slate-600 dark:text-slate-400">
                        Latest articles from NewsOrg’s Everything API for your search term.
                      </p>
                    </div>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
                  {topic && (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-semibold bg-blue-600 px-3 py-1 rounded-full">
                          {topic.category}
                        </span>
                        <span className="text-sm text-slate-300">
                          Started {new Date(topic.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                          })}
                        </span>
                      </div>
                      <h1 className="text-3xl md:text-4xl font-bold mb-3">{topic.title}</h1>
                      <p className="text-lg text-slate-200">{topic.description}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 md:p-8">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  {topic ? 'Topic Timeline' : `Search Results for "${decodedTopicId}"`}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-8">
                  {topic
                    ? 'Latest related news articles from the NewsOrg Everything API.'
                    : 'Search results rendered as an interactive timeline.'}
                </p>

                {loading ? (
                  <div className="rounded-3xl bg-slate-50 dark:bg-slate-800 p-10 text-center text-slate-500 dark:text-slate-400">
                    Loading articles...
                  </div>
                ) : error ? (
                  <div className="rounded-3xl bg-red-50 dark:bg-red-900/20 p-10 text-center text-red-700 dark:text-red-200">
                    {error}
                  </div>
                ) : articles.length > 0 ? (
                  <Timeline events={articles} />
                ) : (
                  <div className="rounded-3xl bg-slate-50 dark:bg-slate-800 p-10 text-center text-slate-600 dark:text-slate-400">
                    No articles found for “{searchQuery}”. Try a different keyword.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
