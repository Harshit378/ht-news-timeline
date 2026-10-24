'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import StoryTimeline from '@/app/components/timeline/StoryTimeline';
import EmptyState from '@/app/components/shell/EmptyState';
import TimelineSkeleton from '@/app/components/timeline/TimelineSkeleton';

// Query-param route (not /story/[q]) so it works with `output: 'export'` for any search term.
function StoryPageInner() {
  const params = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const category = params.get('category') ?? undefined;

  if (!q) {
    return (
      <EmptyState title="Which story?" body="Search for any event, person or topic to see its full timeline.">
        <Link
          href="/search/"
          className="inline-flex min-h-[44px] items-center rounded-full bg-accent px-5 text-sm font-semibold text-white"
        >
          Search stories
        </Link>
      </EmptyState>
    );
  }
  return <StoryTimeline key={`${q}|${category ?? ''}`} query={q} category={category} />;
}

export default function StoryPage() {
  return (
    <Suspense fallback={<TimelineSkeleton />}>
      <StoryPageInner />
    </Suspense>
  );
}
