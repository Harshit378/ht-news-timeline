import type { SourceComparisonData } from '@/app/lib/api-client';

/** One outlet's coverage of a story, newest report first. */
export interface SourceCoverage {
  source: string;
  reportCount: number;
  latest: { id: string; title: string; publishedAt: string; url?: string };
  /** Older reports from the same outlet (headline + id), newest first. */
  earlier: { id: string; title: string; publishedAt: string }[];
  /** What the AI comparison says is specific to this outlet, if anything. */
  differences: string[];
}

export interface StoryComparison {
  commonThemes: string[];
  sources: SourceCoverage[];
}

export type { SourceComparisonData };
