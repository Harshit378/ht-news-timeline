'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, BookmarkX, Check, CircleDot, Share2 } from 'lucide-react';
import type { FeedArticle } from '@/app/types/article';
import { useFeed } from '@/app/contexts/FeedContext';
import { shareContent } from '@/app/lib/native';

/** Bottom sheet opened by long-pressing a card (replaces desktop hover/right-click actions). */
export default function ArticleActionSheet({
  article,
  onClose,
}: {
  article: FeedArticle;
  onClose: () => void;
}) {
  const { isBookmarked, toggleBookmark, readIds, setRead } = useFeed();
  const saved = isBookmarked(article.id);
  const read = readIds.has(article.id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const actions = [
    {
      label: saved ? 'Remove from saved' : 'Save for later',
      icon: saved ? BookmarkX : Bookmark,
      run: () => toggleBookmark(article),
    },
    {
      label: 'Share',
      icon: Share2,
      run: () =>
        void shareContent({ title: article.title, text: article.excerpt, url: article.url }),
    },
    {
      label: read ? 'Mark as unread' : 'Mark as read',
      icon: read ? CircleDot : Check,
      run: () => setRead(article.id, !read),
    },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Article actions">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--scrim)]"
        aria-label="Close actions"
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 mx-auto max-w-lg animate-[sheet-up_200ms_ease-out] rounded-t-2xl border-t border-border bg-surface pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mt-2 mb-3 h-1 w-10 rounded-full bg-dim" aria-hidden />
        <p className="line-clamp-2 px-5 pb-3 font-serif text-base font-bold leading-snug text-ink">
          {article.title}
        </p>
        <ul className="border-t border-border">
          {actions.map(({ label, icon: Icon, run }) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => {
                  run();
                  onClose();
                }}
                className="flex min-h-[52px] w-full items-center gap-4 px-5 text-left text-[15px] text-ink active:bg-surface-alt"
              >
                <Icon className="h-5 w-5 text-muted" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
}
