'use client';

import { useState } from 'react';
import { ChevronDown, Scale } from 'lucide-react';
import { useFeed } from '@/app/contexts/FeedContext';
import { useHydrated } from '@/app/hooks/useHydrated';
import type { StoryComparison } from './types';

const COLLAPSED_SOURCES = 4;

/** How outlets covered the same story (ADR-004): shared themes, then each source with what sets it apart. */
export default function SourceComparison({ comparison }: { comparison: StoryComparison }) {
  const { openArticle } = useFeed();
  const hydrated = useHydrated();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? comparison.sources : comparison.sources.slice(0, COLLAPSED_SOURCES);

  const toggle = (source: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });

  const time = (iso: string) =>
    hydrated ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '';

  return (
    <section className="mx-4 mt-3 rounded-[10px] border border-border bg-surface p-4" aria-label="How sources compare">
      <p className="mb-3 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-gold">
        <Scale className="h-3.5 w-3.5" aria-hidden />
        How sources compare
      </p>

      {comparison.commonThemes.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs text-muted">Most sources cover</p>
          <ul className="flex flex-wrap gap-1.5">
            {comparison.commonThemes.map((theme) => (
              <li key={theme} className="rounded-full border border-border bg-surface-alt px-2.5 py-1 text-xs text-ink">
                {theme}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="divide-y divide-border border-t border-border">
        {visible.map((s) => {
          const open = expanded.has(s.source);
          return (
            <li key={s.source} className="py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-ink">{s.source}</span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted">
                  {s.reportCount} {s.reportCount === 1 ? 'report' : 'reports'}
                </span>
              </div>
              {s.differences.map((d) => (
                <p key={d} className="mt-1.5 border-l-2 border-accent pl-2 text-sm text-ink">
                  {d}
                </p>
              ))}
              <button
                type="button"
                onClick={() => openArticle(s.latest.id)}
                className="mt-1.5 block min-h-[44px] w-full text-left text-sm text-muted active:text-ink"
              >
                <span className="font-mono text-[10px] text-gold">{time(s.latest.publishedAt)}</span>{' '}
                {s.latest.title}
              </button>
              {s.earlier.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => toggle(s.source)}
                    aria-expanded={open}
                    className="flex min-h-[32px] items-center gap-1 text-xs font-semibold text-muted"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                    {open ? 'Hide' : 'Show'} {s.earlier.length} earlier
                  </button>
                  {open && (
                    <ul className="mt-1 space-y-1">
                      {s.earlier.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => openArticle(a.id)}
                            className="block min-h-[36px] w-full text-left text-xs text-muted active:text-ink"
                          >
                            <span className="font-mono text-[10px] text-gold">{time(a.publishedAt)}</span> {a.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      {comparison.sources.length > COLLAPSED_SOURCES && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-1 min-h-[44px] text-xs font-semibold uppercase tracking-wide text-gold"
        >
          {showAll ? 'Show fewer sources' : `Show all ${comparison.sources.length} sources`}
        </button>
      )}
      <p className="mt-2 font-mono text-[11px] text-muted">AI comparison of headlines and excerpts · may contain errors</p>
    </section>
  );
}
