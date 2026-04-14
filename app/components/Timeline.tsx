'use client';

import { useState, useMemo } from 'react';
import StoryCard from './StoryCard';
import { TimelineEvent } from '@/app/types/timeline';

interface TimelineProps {
  events: TimelineEvent[];
}

type SortOption = 'date-asc' | 'date-desc';

export default function Timeline({ events }: TimelineProps) {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    events.forEach((event) => {
      event.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [events]);

  // Sort and filter events
  const sortedAndFilteredEvents = useMemo(() => {
    let filtered = events;

    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = events.filter((event) =>
        event.tags.some((tag) => selectedTags.includes(tag))
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortBy === 'date-asc' ? dateA - dateB : dateB - dateA;
    });

    return sorted;
  }, [events, selectedTags, sortBy]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="mb-8 space-y-4">
        {/* Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <label htmlFor="sort" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Sort by:
          </label>
          <select
            id="sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-white dark:border-slate-600"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
          </select>
        </div>

        {/* Tag Filters */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Filter by tags:</p>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-4 md:left-1/2 transform md:-translate-x-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600"></div>

        {/* Timeline Events */}
        <div className="space-y-6 md:space-y-8">
          {sortedAndFilteredEvents.length > 0 ? (
            sortedAndFilteredEvents.map((event, index) => (
              <div
                key={event.id}
                className={`flex flex-col md:flex-row gap-6 ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                {/* Event Dot */}
                <div className="flex flex-col items-center md:w-1/2">
                  <button
                    onClick={() =>
                      setExpandedEventId(
                        expandedEventId === event.id ? null : event.id
                      )
                    }
                    className="relative z-10 flex items-center justify-center w-10 h-10 bg-white border-4 border-blue-500 rounded-full hover:scale-125 transition-transform dark:bg-slate-800 shadow-lg"
                  >
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  </button>
                  {index < sortedAndFilteredEvents.length - 1 && (
                    <div className="hidden md:block h-12 w-1 bg-slate-300 dark:bg-slate-700"></div>
                  )}
                </div>

                {/* Event Content */}
                <div className="md:w-1/2 pl-8 md:pl-0">
                  <StoryCard
                    event={event}
                    isExpanded={expandedEventId === event.id}
                    onToggleExpand={() =>
                      setExpandedEventId(
                        expandedEventId === event.id ? null : event.id
                      )
                    }
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">
                No events found matching your filters.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
