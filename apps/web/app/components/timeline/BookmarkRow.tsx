'use client';

import { useState } from 'react';
import type { FeedArticle } from '@/app/types/article';
import { useFeed } from '@/app/contexts/FeedContext';
import { useLongPress } from '@/app/hooks/useLongPress';
import { categoryTagStyle } from '@/app/lib/category-style';
import ArticleActionSheet from '@/app/components/shell/ArticleActionSheet';

export default function BookmarkRow({ article }: { article: FeedArticle }) {
  const { openArticle, readIds } = useFeed();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { handlers, consumeLongPress } = useLongPress(() => setSheetOpen(true));
  const isRead = readIds.has(article.id);

  return (
    <>
      <button
        type="button"
        {...handlers}
        onClick={() => {
          if (consumeLongPress()) return;
          openArticle(article);
        }}
        className="block w-full select-none rounded-[10px] border border-border bg-surface-alt p-4 text-left active:bg-surface"
      >
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {!isRead && <span className="h-2 w-2 rounded-full bg-accent" aria-label="Unread" />}
              <span className="font-mono text-[10px] uppercase tracking-wide text-muted">{article.source}</span>
              <span
                className="rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide"
                style={categoryTagStyle(article.category)}
              >
                {article.category}
              </span>
              <span className="font-mono text-[10px] text-gold">
                {new Date(article.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <h2 className={`font-serif text-base font-bold leading-snug ${isRead ? 'text-muted' : 'text-ink'}`}>
              {article.title}
            </h2>
          </div>
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-2xl"
            aria-hidden
          >
            {article.thumbnailEmoji}
          </div>
        </div>
      </button>
      {sheetOpen && <ArticleActionSheet article={article} onClose={() => setSheetOpen(false)} />}
    </>
  );
}
