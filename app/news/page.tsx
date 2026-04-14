'use client';

import Header from '@/app/components/header';
import PinnedTopics from '@/app/components/PinnedTopics';
import { useNews } from '@/app/contexts/NewsContext';
import Link from 'next/link';
import { Pin, PinOff } from 'lucide-react';

export default function NewsPage() {
  const { allTopics, pinnedItems, togglePinnedItem, isPinnedItem } = useNews();

  const featuredTopics = allTopics.filter((t) => t.featured);
  const otherTopics = allTopics.filter((t) => !t.featured);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Header />

      <div className="pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              News Stories That Matter
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              Follow the complete evolution of your favorite topics from initiation to present day. 
              Understand the full context and historical development of every story.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar - Pinned Topics */}
            <aside className="lg:col-span-1">
              <div className="sticky top-24 bg-white dark:bg-slate-800 rounded-xl shadow-md p-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                  📌 Pinned Topics
                </h2>
                {pinnedItems.length > 0 ? (
                  <PinnedTopics />
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No topics pinned yet. Click the pin icon on any topic to follow it here.
                  </p>
                )}
              </div>
            </aside>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-12">
              {/* Featured Topics */}
              {featuredTopics.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                    ⭐ Featured Topics
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {featuredTopics.map((topic) => (
                      <TopicCard
                        key={topic.id}
                        topic={topic}
                        isPinned={isPinnedItem('topic', topic.id)}
                        onTogglePin={() =>
                          togglePinnedItem({
                            type: 'topic',
                            id: topic.id,
                            title: topic.title,
                            category: topic.category,
                          })
                        }
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* All Topics */}
              <section>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                  📰 All Topics
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {otherTopics.map((topic) => (
                    <TopicCard
                      key={topic.id}
                      topic={topic}
                      isPinned={isPinnedItem('topic', topic.id)}
                      onTogglePin={() =>
                        togglePinnedItem({
                          type: 'topic',
                          id: topic.id,
                          title: topic.title,
                          category: topic.category,
                        })
                      }
                    />
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

interface TopicCardProps {
  topic: any;
  isPinned: boolean;
  onTogglePin: () => void;
}

function TopicCard({ topic, isPinned, onTogglePin }: TopicCardProps) {
  return (
    <Link href={`/news/${topic.id}`}>
      <div className="group bg-white dark:bg-slate-800 rounded-xl shadow-md hover:shadow-xl transition-all overflow-hidden cursor-pointer h-full">
        {/* Image */}
        <div className="relative h-48 overflow-hidden">
          <img
            src={topic.imageUrl}
            alt={topic.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
          
          {/* Pin Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              onTogglePin();
            }}
            className={`absolute top-3 right-3 p-2 rounded-full transition-all ${
              isPinned
                ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
                : 'bg-white/80 text-gray-700 hover:bg-white'
            }`}
            title={isPinned ? 'Unpin topic' : 'Pin topic'}
          >
            {isPinned ? (
              <Pin className="w-5 h-5 fill-current" />
            ) : (
              <PinOff className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full">
              {topic.category}
            </span>
            {topic.featured && (
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-full">
                Featured
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 mb-2">
            {topic.title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
            {topic.description}
          </p>
          <div className="flex items-center justify-between">
            <time className="text-xs text-slate-500 dark:text-slate-500">
              Started {new Date(topic.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
            </time>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              View Timeline →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
