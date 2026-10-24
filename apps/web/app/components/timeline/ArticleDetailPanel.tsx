'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bookmark, ExternalLink, GitCommitVertical, Share2 } from 'lucide-react';
import { useFeed } from '@/app/contexts/FeedContext';
import { categoryName, categoryTagStyle } from '@/app/lib/category-style';
import { shareContent } from '@/app/lib/native';
import { deriveStoryQuery, storyHref } from '@/app/lib/story-query';

const ICON_BTN =
  'flex h-11 w-11 items-center justify-center rounded-md text-muted active:bg-surface-alt';

/** Full-screen article overlay (ADR-001): slides in from the right, tracks reading progress. */
export default function ArticleDetailPanel() {
  const { activeArticle, closeArticle, toggleBookmark, isBookmarked } = useFeed();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeArticle();
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [closeArticle]);

  useEffect(() => {
    setProgress(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activeArticle?.id]);

  if (!activeArticle) return null;

  const saved = isBookmarked(activeArticle.id);
  const dateStr = new Date(activeArticle.publishedAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const sourceHref =
    activeArticle.url ||
    `https://www.google.com/search?q=${encodeURIComponent(`${activeArticle.source} ${activeArticle.title}`)}`;
  const storyQuery = deriveStoryQuery(activeArticle.title);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 1);
  };

  const onShare = async () => {
    const result = await shareContent({
      title: activeArticle.title,
      text: activeArticle.excerpt,
      url: activeArticle.url,
    });
    if (result === 'copied') {
      setToast('Link copied');
      window.setTimeout(() => setToast(null), 1800);
    }
  };

  return (
    <aside
      className="fixed inset-0 z-50 flex animate-[slide-in-right_200ms_ease-out] flex-col bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label={activeArticle.title}
    >
      <header className="relative shrink-0 border-b border-border bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-1 px-2 py-1">
          <button type="button" onClick={closeArticle} className={ICON_BTN} aria-label="Back">
            <ArrowLeft className="h-5 w-5 text-ink" />
          </button>
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] uppercase tracking-wider text-muted">
            {activeArticle.source}
          </span>
          <button
            type="button"
            onClick={() => toggleBookmark(activeArticle)}
            className={`${ICON_BTN} ${saved ? 'text-gold' : ''}`}
            aria-label={saved ? 'Remove bookmark' : 'Bookmark'}
            aria-pressed={saved}
          >
            <Bookmark className={`h-5 w-5 ${saved ? 'fill-current' : ''}`} />
          </button>
          <button type="button" className={ICON_BTN} aria-label="Share" onClick={onShare}>
            <Share2 className="h-5 w-5" />
          </button>
          <a href={sourceHref} target="_blank" rel="noreferrer" className={ICON_BTN} aria-label="Open source">
            <ExternalLink className="h-5 w-5" />
          </a>
        </div>
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-accent transition-[width] duration-100"
          style={{ width: `${progress * 100}%` }}
          role="progressbar"
          aria-label="Reading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        />
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(2rem+env(safe-area-inset-bottom))]"
      >
        <article className="mx-auto max-w-lg px-5 py-6">
          <span
            className="mb-3 inline-block rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest"
            style={categoryTagStyle(activeArticle.category)}
          >
            {categoryName(activeArticle.category)}
          </span>
          <h1 className="mb-4 font-serif text-[28px] font-bold leading-[1.15] text-ink">{activeArticle.title}</h1>
          <p className="mb-6 font-mono text-[11px] uppercase tracking-wide text-gold">
            {dateStr} · {activeArticle.readTimeMinutes} min read
          </p>

          {activeArticle.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeArticle.imageUrl}
              alt=""
              className="mb-8 aspect-[16/9] w-full rounded-lg border border-border object-cover"
            />
          ) : (
            <div
              className="mb-8 flex aspect-[16/9] items-center justify-center rounded-lg border border-border bg-surface text-6xl"
              aria-hidden
            >
              {activeArticle.thumbnailEmoji}
            </div>
          )}

          <div className="text-[16px] font-light leading-[1.75] text-ink">
            {activeArticle.body.split('\n\n').map((para, i) => (
              <p
                key={i}
                className={`mb-5 ${
                  i === 0
                    ? 'first-letter:float-left first-letter:mr-2 first-letter:font-serif first-letter:text-[56px] first-letter:font-black first-letter:leading-[0.85] first-letter:text-accent'
                    : ''
                }`}
              >
                {para}
              </p>
            ))}
          </div>

          {storyQuery && (
            <Link
              href={storyHref(storyQuery, activeArticle.category)}
              className="mt-8 flex min-h-[52px] items-center gap-3 rounded-[10px] border border-border bg-surface-alt px-4 text-left active:bg-surface"
            >
              <GitCommitVertical className="h-5 w-5 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">Trace this story from the beginning</span>
                <span className="block truncate font-mono text-[11px] text-muted">“{storyQuery}”</span>
              </span>
            </Link>
          )}

          <a
            href={sourceHref}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex min-h-[48px] items-center justify-center rounded-[10px] border border-border text-sm font-semibold text-muted active:bg-surface-alt"
          >
            Read the full story at {activeArticle.source}
          </a>
        </article>
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] flex justify-center">
          <span className="rounded-full bg-ink px-4 py-2 text-sm text-bg">{toast}</span>
        </div>
      )}
    </aside>
  );
}
