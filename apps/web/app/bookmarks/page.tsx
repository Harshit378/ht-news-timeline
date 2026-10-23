'use client';

import { useMemo, useState } from 'react';
import PageHeader from '@/app/components/shell/PageHeader';
import EmptyState from '@/app/components/shell/EmptyState';
import BookmarkRow from '@/app/components/timeline/BookmarkRow';
import { useFeed } from '@/app/contexts/FeedContext';

type Tab = 'all' | 'unread' | 'read';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'read', label: 'Read' },
];

export default function BookmarksPage() {
  const { savedArticles, readIds, setRead } = useFeed();
  const [tab, setTab] = useState<Tab>('all');

  const readCount = savedArticles.filter((a) => readIds.has(a.id)).length;
  const unreadCount = savedArticles.length - readCount;

  const visible = useMemo(() => {
    if (tab === 'all') return savedArticles;
    return savedArticles.filter((a) => readIds.has(a.id) === (tab === 'read'));
  }, [savedArticles, readIds, tab]);

  const stats = [
    { label: 'Saved', value: savedArticles.length },
    { label: 'Unread', value: unreadCount },
    { label: 'Read', value: readCount },
  ];

  return (
    <>
      <PageHeader kicker="Your library" title="Saved">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 rounded-full border border-border p-0.5" role="tablist">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`min-h-[36px] flex-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                  tab === id ? 'bg-accent text-white' : 'text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => savedArticles.forEach((a) => setRead(a.id, true))}
              className="min-h-[36px] shrink-0 px-2 text-xs font-semibold text-gold"
            >
              Mark all read
            </button>
          )}
        </div>
      </PageHeader>

      <dl className="grid grid-cols-3 gap-2 px-4 pt-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="rounded-[10px] border border-border bg-surface px-3 py-2">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</dt>
            <dd className="font-serif text-2xl font-black text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {visible.length === 0 ? (
        <EmptyState
          title={savedArticles.length === 0 ? 'No saved stories yet' : 'Nothing in this list'}
          body={
            savedArticles.length === 0
              ? 'Tap the bookmark in an article, or long-press any card, to save it here.'
              : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-3 px-4 py-4">
          {visible.map((article) => (
            <li key={article.id}>
              <BookmarkRow article={article} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
