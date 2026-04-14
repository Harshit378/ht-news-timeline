'use client';

import { useNews } from '@/app/contexts/NewsContext';
import Link from 'next/link';
import { X } from 'lucide-react';

export default function PinnedTopics() {
  const { pinnedItems, togglePinnedItem } = useNews();

  if (pinnedItems.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          No pinned topics yet. Click the pin icon on any topic to add it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pinnedItems.map((item) => (
        <Link
          key={`${item.type}:${item.id}`}
          href={`/news/${encodeURIComponent(item.id)}`}
          className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1">
              {item.title}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {item.category}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              togglePinnedItem(item);
            }}
            className="flex-shrink-0 p-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors opacity-0 group-hover:opacity-100"
            title="Unpin topic"
          >
            <X className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
        </Link>
      ))}
    </div>
  );
}
