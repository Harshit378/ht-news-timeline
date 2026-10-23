'use client';

import React from 'react';
import { LiveEventTimeline } from './types';
import { AlertCircle } from 'lucide-react';

interface LiveEventTimelineComponentProps {
  timeline: LiveEventTimeline;
}

export default function LiveEventTimelineComponent({ timeline }: LiveEventTimelineComponentProps) {
  const statusColors = {
    ongoing: 'bg-red-500',
    completed: 'bg-dim',
    scheduled: 'bg-yellow-500',
  };

  const categoryColors = {
    election: 'text-gold',
    sports: 'text-green-400',
    summit: 'text-purple-400',
    breaking: 'text-red-400',
  };

  const sortedEvents = [...timeline.events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="w-full p-4 bg-surface rounded-lg border border-border">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-3 h-3 rounded-full ${statusColors[timeline.status]}`}></div>
          <h2 className="text-2xl font-bold text-ink">{timeline.name}</h2>
          <span
            className={`text-sm px-2 py-1 rounded-full bg-surface-alt ${categoryColors[timeline.category]}`}
          >
            {timeline.category}
          </span>
        </div>
        <p className="text-muted text-sm">{timeline.description}</p>
        <p className="text-ink0 text-xs mt-2">
          Last updated: {new Date(timeline.lastUpdated).toLocaleString()}
        </p>
      </div>

      <div className="relative">
        {sortedEvents.length === 0 ? (
          <div className="text-center py-8 text-ink0">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No events yet for this timeline</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedEvents.map((event, index) => (
              <div key={event.id} className="relative">
                {index !== 0 && (
                  <div className="absolute left-6 top-0 h-4 w-0.5 bg-dim -translate-y-4"></div>
                )}

                <div className="flex gap-4">
                  <div className="relative mt-1">
                    <div className="w-3 h-3 rounded-full bg-red-500 relative z-10"></div>
                    {index !== sortedEvents.length - 1 && (
                      <div className="absolute left-1 top-3 w-0.5 h-12 bg-dim"></div>
                    )}
                  </div>

                  <div className="flex-1 pb-4">
                    <div className="bg-surface-alt rounded-lg p-3 border border-border">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-ink">{event.title}</h3>
                        <span className="text-xs text-muted">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <p className="text-muted text-sm mb-3">{event.description}</p>

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="text-xs text-muted">
                          <span className="font-semibold">Sources:</span> {event.sourceCount}
                        </div>
                        <div className="text-xs text-muted">
                          <span className="font-semibold">Status:</span> {event.status}
                        </div>
                      </div>

                      {event.sources.length > 0 && (
                        <div className="bg-surface rounded p-2 mb-2 border border-border">
                          <p className="text-xs font-semibold text-muted mb-2">Coverage:</p>
                          <div className="space-y-1">
                            {event.sources.slice(0, 3).map((source, i) => (
                              <div key={i} className="text-xs text-muted">
                                <span className="font-medium text-muted">{source.name}:</span>{' '}
                                {source.headline}
                              </div>
                            ))}
                            {event.sources.length > 3 && (
                              <p className="text-xs text-ink0">
                                +{event.sources.length - 3} more sources
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {event.updates.length > 0 && (
                        <div className="border-t border-border pt-2">
                          <p className="text-xs font-semibold text-muted mb-2">Updates:</p>
                          <div className="space-y-1">
                            {event.updates.slice(0, 2).map((update) => (
                              <div
                                key={update.id}
                                className={`text-xs p-1.5 rounded ${
                                  update.importance === 'critical'
                                    ? 'bg-red-900 text-red-200'
                                    : update.importance === 'high'
                                      ? 'bg-orange-900 text-orange-200'
                                      : 'bg-dim text-muted'
                                }`}
                              >
                                {update.message}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
