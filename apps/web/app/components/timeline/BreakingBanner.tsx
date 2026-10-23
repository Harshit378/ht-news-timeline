'use client';

import { X } from 'lucide-react';
import { useFeed } from '@/app/contexts/FeedContext';

export default function BreakingBanner() {
  const { breaking, dismissBreaking, openArticle } = useFeed();

  if (!breaking) return null;

  const time = new Date(breaking.publishedAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-center gap-3 bg-accent px-4 py-2 text-white" role="status">
      <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider">
        Breaking
      </span>
      <button
        type="button"
        onClick={() => openArticle(breaking.articleId)}
        className="line-clamp-2 min-h-[44px] min-w-0 flex-1 text-left text-sm font-medium leading-snug"
      >
        {breaking.headline}
      </button>
      <span className="shrink-0 font-mono text-[11px] text-white/85">{time}</span>
      <button
        type="button"
        onClick={dismissBreaking}
        className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md active:bg-white/15"
        aria-label="Dismiss breaking news"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
