export interface ArticleRecord {
  id: string;
  headline: string;
  excerpt: string;
  body: string | null;
  source: string;
  sourceDomain: string | null;
  url: string | null;
  category: string;
  publishedAt: Date;
  imageUrl: string | null;
  sentiment: string | null;
  bias: string | null;
  importance: string;
  storyClusterId: string | null;
  tone: number | null;
}

export interface BookmarkRecord {
  id: string;
  userId: string;
  articleId: string;
  createdAt: Date;
}

export interface TopicSummaryRecord {
  id: string;
  topicName: string;
  generatedAt: Date;
  summary: string;
  keyPoints: string[];
  sentiment: string;
  articleCount: number;
  sourceCount: number;
  relatedTopics: string[];
  trend: string;
  confidence: number;
}

export interface RssFeedRecord {
  id: string;
  title: string;
  url: string;
  description: string | null;
  category: string;
  isActive: boolean;
  lastChecked: Date | null;
  itemCount: number;
  addedAt: Date;
}

export interface EventUpdateRecord {
  id: string;
  eventId: string;
  timestamp: Date;
  message: string;
  importance: string;
  sources: string[];
}

export interface LiveEventRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  lastUpdated: Date;
  updates?: EventUpdateRecord[];
}
