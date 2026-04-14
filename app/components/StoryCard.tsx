'use client';

import { ChevronDown } from 'lucide-react';
import { TimelineEvent } from '@/app/types/timeline';

interface StoryCardProps {
  event: TimelineEvent;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export default function StoryCard({
  event,
  isExpanded,
  onToggleExpand,
}: StoryCardProps) {
  const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className={`bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 ${
        isExpanded ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      {/* Collapsed View */}
      <button
        onClick={onToggleExpand}
        className="w-full p-4 md:p-6 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <time className="text-xs md:text-sm font-semibold text-blue-600 dark:text-blue-400">
                {formattedDate}
              </time>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                • {event.source}
              </span>
            </div>
            <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">
              {event.title}
            </h3>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 line-clamp-2">
              {event.description}
            </p>
          </div>
          <ChevronDown
            className={`flex-shrink-0 w-5 h-5 md:w-6 md:h-6 text-slate-400 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Expanded View */}
      {isExpanded && (
        <div className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          {/* Event Image */}
          {event.imageUrl && (
            <div className="relative w-full h-48 md:h-56 overflow-hidden">
              <img
                src={event.imageUrl}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Full Content */}
          <div className="p-4 md:p-6 space-y-4">
            {/* Meta Information */}
            <div className="flex flex-col sm:flex-row gap-4 text-sm text-slate-600 dark:text-slate-400">
              <div>
                <span className="font-semibold">Published:</span> {formattedDate}
              </div>
              <div>
                <span className="font-semibold">Source:</span> {event.source}
              </div>
            </div>

            {/* Full Description */}
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                Overview
              </h4>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {event.description}
              </p>
            </div>

            {/* Detailed Content */}
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                Details
              </h4>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {event.content}
              </p>
            </div>

            {/* Tags */}
            {event.tags.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                  Topics
                </h4>
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-block px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded-full text-xs font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
