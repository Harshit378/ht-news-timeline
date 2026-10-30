'use client';

import type { FeedArticle } from '@/app/types/article';
import type { TimelineGroup } from '@/app/lib/timeline-grouping';
import NewsCard from '@/app/components/timeline/NewsCard';
import TimelineDot from '@/app/components/timeline/TimelineDot';
import { ExternalLink } from 'lucide-react';

/** A dated event from Wikipedia (ADR-008 step 6): the story's skeleton between news reports. CC BY-SA. */
function MilestoneCard({ article }: { article: FeedArticle }) {
  return (
    <>
      <span className="mt-1.5 flex w-5 shrink-0 justify-center" aria-hidden>
        <span className="h-2.5 w-2.5 rotate-45 bg-gold" />
      </span>
      <div className="min-w-0 flex-1 rounded-[10px] border border-gold/40 bg-surface px-3 py-2.5">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-gold">Milestone</p>
        <p className="text-sm leading-relaxed text-ink">{article.title}</p>
        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-[32px] items-center gap-1 text-xs text-muted"
          >
            From Wikipedia · CC BY-SA <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </>
  );
}

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
            {group.items.map((article) =>
              article.kind === 'milestone' ? (
                <li key={article.id} className="relative flex gap-2 pb-4">
                  <MilestoneCard article={article} />
                </li>
              ) : (
                <li key={article.id} className="relative flex gap-2 pb-4">
                  <TimelineDot articleId={article.id} isBreaking={article.isBreaking} />
                  <div className="min-w-0 flex-1">
                    <NewsCard article={article} stamp={stamp} />
                  </div>
                </li>
              ),
            )}
          </ol>
        </section>
      ))}
    </div>
  );
}
