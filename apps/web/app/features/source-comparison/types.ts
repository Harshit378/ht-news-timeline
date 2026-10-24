export interface SourceVersion {
  sourceId: string;
  sourceName: string;
  headline: string;
  excerpt: string;
  content: string;
  imageUrl?: string;
  publishedAt: string;
  url: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  bias?: 'left' | 'center' | 'right';
}

export interface ComparisonArticle {
  id: string;
  storyId: string;
  topic: string;
  sources: SourceVersion[];
  firstReported: string;
  lastUpdated: string;
  commonThemes: string[];
  differences: string[];
  aggregatedHeadline: string;
}
