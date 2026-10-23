export interface TopicSummary {
  id: string;
  topicName: string;
  generatedAt: string;
  summary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  articleCount: number;
  sourceCount: number;
  relatedTopics: string[];
  trend: 'rising' | 'stable' | 'declining';
  confidence: number; // 0-1
}

export interface SummaryRequest {
  topicName: string;
  articleIds: string[];
  maxLength?: number; // chars
}
