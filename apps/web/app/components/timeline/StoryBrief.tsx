'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { getStoryBrief, type StoryBrief as Brief } from '@/app/lib/api-client';
import SourceComparison from '@/app/features/source-comparison/SourceComparison';
import { buildComparison } from '@/app/features/source-comparison/comparison';
import type { FeedArticle } from '@/app/types/article';

const POLL_MS = 3000;
/** ~2 min: the first brief after Ollama starts includes loading the model. */
const MAX_POLLS = 40;

/**
 * AI "What happened" brief for a story (ADR-004). Written in the background by the API after the
 * timeline loads; this polls until it's ready and renders nothing if it never is.
 */
export default function StoryBrief({
  query,
  category,
  items = [],
}: {
  query: string;
  category?: string;
  /** The story's reports, for the source comparison under the brief. */
  items?: FeedArticle[];
}) {
  const [state, setState] = useState<'pending' | 'ready' | 'none'>('pending');
  const [brief, setBrief] = useState<Brief | null>(null);
  const comparison = useMemo(
    () => buildComparison(items, brief?.comparison),
    [items, brief],
  );

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;
    setState('pending');
    setBrief(null);
    const poll = () => {
      getStoryBrief(query, category, controller.signal)
        .then((res) => {
          if (res.status === 'ready' && res.brief) {
            setBrief(res.brief);
            setState('ready');
          } else if (res.status === 'pending' && ++polls < MAX_POLLS) {
            timer = setTimeout(poll, POLL_MS);
          } else {
            setState('none');
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setState('none');
        });
    };
    poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, category]);

  if (state === 'none') return null;

  return (
    <>
      <section
        className="mx-4 mt-3 rounded-[10px] border border-border bg-surface p-4"
        aria-label="AI summary of this story"
        aria-busy={state === 'pending'}
      >
        <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-gold">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          What happened
        </p>
        {state === 'pending' || !brief ? (
          <div className="animate-pulse">
            <div className="mb-2 h-3 w-full rounded bg-dim" />
            <div className="mb-2 h-3 w-11/12 rounded bg-dim" />
            <div className="mb-3 h-3 w-2/3 rounded bg-dim" />
            <p className="font-mono text-[11px] text-muted">
              Writing a summary…
            </p>
          </div>
        ) : (
          <>
            <p className="font-serif text-[15px] leading-relaxed text-ink">
              {brief.summary}
            </p>
            {brief.keyPoints.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink marker:text-accent">
                {brief.keyPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 font-mono text-[11px] text-muted">
              AI summary of {brief.articleCount} reports from{' '}
              {brief.sourceCount} sources
              {brief.model ? ` · ${brief.model}` : ''} · may contain errors —
              check the reports below
            </p>
          </>
        )}
      </section>
      {comparison && <SourceComparison comparison={comparison} />}
    </>
  );
}
