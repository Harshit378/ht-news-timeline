import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NewsStore } from '../store/news.store';
import { TopicSummaryRecord } from '../store/types';

@Injectable()
export class SummariesService {
  constructor(private readonly store: NewsStore) {}

  get(topicName: string) {
    return this.store.getSummary(topicName);
  }

  list() {
    return this.store.listSummaries();
  }

  async generate(topicName: string) {
    const articles = this.store.listArticles(topicName).slice(0, 12);
    const headlines = articles.map((a) => `${a.source}: ${a.headline}`);
    const sentiments = articles.map((a) => a.sentiment);
    const positive = sentiments.filter((s) => s === 'positive').length;
    const negative = sentiments.filter((s) => s === 'negative').length;
    let sentiment = 'neutral';
    if (positive > negative + 1) sentiment = 'positive';
    if (negative > positive + 1) sentiment = 'negative';

    const keyPoints = headlines.slice(0, 3).map((h) => h.slice(0, 140));
    const summary: TopicSummaryRecord = {
      id: randomUUID(),
      topicName,
      generatedAt: new Date(),
      summary:
        headlines.length === 0
          ? `No recent coverage for ${topicName}.`
          : `Snapshot of ${topicName}: ${headlines.slice(0, 2).join(' · ')}`,
      keyPoints: keyPoints.length ? keyPoints : ['Coverage is still collecting for this topic.'],
      sentiment,
      articleCount: articles.length,
      sourceCount: new Set(articles.map((a) => a.source)).size,
      relatedTopics: ['world', 'tech', 'finance'].filter((t) => t !== topicName),
      trend: articles.length > 8 ? 'rising' : articles.length > 3 ? 'stable' : 'declining',
      confidence: articles.length ? Math.min(0.92, 0.45 + articles.length / 20) : 0.3,
    };
    return this.store.saveSummary(summary);
  }

  async generateAll() {
    const topics = [...new Set(this.store.listArticles().map((a) => a.category))];
    const out = [];
    for (const topic of topics) {
      out.push(await this.generate(topic));
    }
    return out;
  }
}
