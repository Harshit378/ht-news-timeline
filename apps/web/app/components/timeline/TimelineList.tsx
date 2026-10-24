'use client';

import type { FeedArticle } from '@/app/types/article';
import type { TimelineGroup } from '@/app/lib/timeline-grouping';
import NewsCard from '@/app/components/timeline/NewsCard';
import TimelineDot from '@/app/components/timeline/TimelineDot';

/** Date-grouped vertical timeline rail shared by the home feed and story timelines. */
export default function TimelineList({
  groups,
  stamp = 'time',
}: {
  groups: TimelineGroup<FeedArticle>[];
  stamp?: 'time' | 'date';
}) {
  return (
    <div className="px-4">
      {groups.map((group) => (
        <section key={group.key} className="mb-6" aria-label={group.label}>
          <div className="sticky top-[var(--page-header-h,0px)] z-10 -mx-4 mb-3 bg-bg/95 px-4 py-2 backdrop-blur-sm">
            <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-gold">
              {group.label}
              <span className="ml-2 text-muted">· {group.items.length}</span>
            </h2>
          </div>
          <ol>
            {group.items.map((article) => (
              <li key={article.id} className="relative flex gap-2 pb-4">
                <TimelineDot articleId={article.id} isBreaking={article.isBreaking} />
                <div className="min-w-0 flex-1">
                  <NewsCard article={article} stamp={stamp} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
