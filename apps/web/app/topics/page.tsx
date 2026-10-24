'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pin, X } from 'lucide-react';
import PageHeader from '@/app/components/shell/PageHeader';
import { useNews } from '@/app/contexts/NewsContext';
import { getTopics } from '@/app/lib/api-client';
import { storyHref } from '@/app/lib/story-query';
import { CORE_TOPICS } from '@/app/types/article';

export default function TopicsPage() {
  const { pinnedItems, togglePinnedItem, isPinnedItem } = useNews();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    getTopics()
      .then((topics) => setCounts(Object.fromEntries(topics.map((t) => [t.slug, t.count]))))
      .catch(() => setCounts({}));
  }, []);

  return (
    <>
      <PageHeader kicker="Browse" title="Topics" subtitle="Tap a topic to see its timeline. Pin the ones you follow." />

      <main className="px-4 py-4">
        {pinnedItems.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Following</h2>
            <ul className="flex flex-col gap-2">
              {pinnedItems.map((p) => {
                const topic = CORE_TOPICS.find((t) => t.slug === p.id);
                return (
                  <li key={`${p.type}:${p.id}`} className="flex items-center gap-2">
                    <Link
                      href={storyHref(p.title, topic?.slug)}
                      className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3 rounded-[10px] border border-border bg-surface-alt px-3 active:bg-surface"
                    >
                      <span className="text-xl" aria-hidden>
                        {topic?.emoji ?? '📌'}
                      </span>
                      <span className="truncate text-sm font-semibold text-ink">{p.title}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => togglePinnedItem(p)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted active:bg-surface-alt"
                      aria-label={`Unpin ${p.title}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <ul className="grid grid-cols-2 gap-3">
          {CORE_TOPICS.map((t) => {
            const pinned = isPinnedItem('topic', t.slug);
            return (
              <li key={t.slug} className="relative">
                <Link
                  href={storyHref(t.name, t.slug)}
                  className="flex min-h-[120px] flex-col justify-between rounded-xl border p-4 active:opacity-80"
                  style={{ backgroundColor: `${t.tint}14`, borderColor: `${t.tint}33` }}
                >
                  <span className="text-3xl" aria-hidden>
                    {t.emoji}
                  </span>
                  <span>
                    <span className="block font-serif text-lg font-bold leading-tight text-ink">{t.name}</span>
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-muted">
                      {counts[t.slug] !== undefined ? `${counts[t.slug]} articles today` : 'Timeline'}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => togglePinnedItem({ type: 'topic', id: t.slug, title: t.name, category: t.slug })}
                  className={`absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-md ${
                    pinned ? 'text-gold' : 'text-muted'
                  }`}
                  aria-label={pinned ? `Unpin ${t.name}` : `Pin ${t.name}`}
                  aria-pressed={pinned}
                >
                  <Pin className={`h-4 w-4 ${pinned ? 'fill-current' : ''}`} />
                </button>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
