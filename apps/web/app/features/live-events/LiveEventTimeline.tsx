'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useHydrated } from '@/app/hooks/useHydrated';
import { LiveEventTimeline, UpdateImportance } from './types';

interface LiveEventTimelineComponentProps {
  timeline: LiveEventTimeline;
  /** Update ids that arrived live this session; highlighted on arrival. */
  freshIds?: Set<string>;
}

const IMPORTANCE: Record<UpdateImportance, { dot: string; label: string }> = {
  critical: { dot: 'bg-accent', label: 'text-accent' },
  high: { dot: 'bg-gold', label: 'text-gold' },
  normal: { dot: 'bg-dim', label: 'text-muted' },
  low: { dot: 'bg-dim', label: 'text-muted' },
};

export default function LiveEventTimelineComponent({ timeline, freshIds }: LiveEventTimelineComponentProps) {
  const hydrated = useHydrated();
  const updates = timeline.updates ?? [];

  return (
    <div className="px-4">
      <p className="text-sm text-muted">{timeline.description}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted">
        {timeline.status} · {timeline.category}
        {hydrated && ` · updated ${new Date(timeline.lastUpdated).toLocaleString()}`}
      </p>

      {updates.length === 0 ? (
        <div className="py-10 text-center text-muted">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">No updates yet. New ones appear here as they happen.</p>
        </div>
      ) : (
        <ol className="relative mt-5 border-l border-border">
          {updates.map((update) => {
            const tone = IMPORTANCE[update.importance] ?? IMPORTANCE.normal;
            const fresh = freshIds?.has(update.id);
            return (
              <li key={update.id} className="relative pb-5 pl-5 last:pb-0">
                <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                <div
                  className={`rounded-[10px] border border-border bg-surface-alt p-3 ${
                    fresh ? 'animate-[live-fresh_3s_ease-out]' : ''
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
                    <span className="text-gold">
                      {hydrated ? new Date(update.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                    {update.importance !== 'normal' && <span className={tone.label}>{update.importance}</span>}
                    {fresh && <span className="text-accent">new</span>}
                  </div>
                  <p className="text-sm leading-relaxed text-ink">{update.message}</p>
                  {update.sources.length > 0 && (
                    <p className="mt-2 text-xs text-muted">{update.sources.join(' · ')}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
