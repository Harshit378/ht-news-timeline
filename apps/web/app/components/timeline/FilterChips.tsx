'use client';

import { FILTER_CATEGORIES, type ArticleCategory } from '@/app/types/article';
import { useFeed } from '@/app/contexts/FeedContext';

const BASE =
  'flex min-h-[36px] shrink-0 items-center rounded-full border px-4 text-xs font-semibold uppercase tracking-wide transition-colors duration-150';
const INACTIVE = 'border-border text-muted active:border-muted';
const ACTIVE = 'border-accent bg-accent text-white';

export default function FilterChips() {
  const { categoryFilters, toggleCategoryFilter, selectAllCategories } = useFeed();

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="toolbar" aria-label="Filter by category">
      {FILTER_CATEGORIES.map(({ id, label }) => {
        const isAll = id === 'all';
        const isActive = isAll ? categoryFilters.length === 0 : categoryFilters.includes(id as ArticleCategory);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={isActive}
            onClick={() => (isAll ? selectAllCategories() : toggleCategoryFilter(id as ArticleCategory))}
            className={`${BASE} ${isActive ? ACTIVE : INACTIVE}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
