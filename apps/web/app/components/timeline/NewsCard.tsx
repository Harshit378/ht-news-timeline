'use client';

import { useState } from 'react';
import type { FeedArticle } from '@/app/types/article';
import { useFeed } from '@/app/contexts/FeedContext';
import { useLongPress } from '@/app/hooks/useLongPress';
import { categoryTagStyle } from '@/app/lib/category-style';
import ArticleActionSheet from '@/app/components/shell/ArticleActionSheet';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function NewsCard({
  article,
  stamp = 'time',
}: {
  article: FeedArticle;
  /** 'time' for the daily feed, 'date' for long-range story timelines. */
  stamp?: 'time' | 'date';
}) {
  const { activeArticleId, openArticle, readIds } = useFeed();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { handlers, consumeLongPress } = useLongPress(() => setSheetOpen(true));
  const isActive = activeArticleId === article.id;
  const isRead = readIds.has(article.id);

  return (
    <article>
      <button
        type="button"
        {...handlers}
        onClick={() => {
          if (consumeLongPress()) return;
          openArticle(article);
        }}
        className={`w-full select-none rounded-[10px] border text-left transition-colors duration-150 active:bg-surface ${
          isActive ? 'border-accent bg-accent-soft' : 'border-border bg-surface-alt'
        }`}
      >
        <div className="flex gap-3 p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-[11px] text-gold">
                {stamp === 'date' ? formatDate(article.publishedAt) : formatTime(article.publishedAt)}
              </span>
              <span className="max-w-[45%] truncate font-mono text-[10px] uppercase tracking-wide text-muted">
                {article.source}
              </span>
              <span
                className="rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide"
                style={categoryTagStyle(article.category)}
              >
                {article.category}
              </span>
            </div>
            <h3
              className={`font-serif text-[17px] font-bold leading-snug ${
                isActive ? 'text-accent' : isRead ? 'text-muted' : 'text-ink'
              }`}
            >
              {article.title}
            </h3>
            <p className="line-clamp-2 text-sm font-light leading-relaxed text-muted">{article.excerpt}</p>
          </div>
          {article.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.imageUrl}
              alt=""
              loading="lazy"
              className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-3xl"
              aria-hidden
            >
              {article.thumbnailEmoji}
            </div>
          )}
        </div>
      </button>
      {sheetOpen && <ArticleActionSheet article={article} onClose={() => setSheetOpen(false)} />}
    </article>
  );
}
