import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LlmUnavailableError } from '../llm/llm-provider';
import { NewsStore } from '../store/news.store';
import { ArticleRecord, TopicSummaryRecord } from '../store/types';
import { SummaryGenerator } from './summary-generator.service';
import { MAX_TOPIC_ARTICLES, inputHash, selectArticles } from './summary-prompt';
import { LlmSummary } from './summary-validate';

/** Topic summaries (ADR-004): written by the LLM on the cron, with a heuristic when it's unavailable. */
@Injectable()
export class SummariesService {
  private readonly logger = new Logger(SummariesService.name);

  constructor(
    private readonly store: NewsStore,
    private readonly generator: SummaryGenerator,
  ) {}

  get(topicName: string) {
    const summary = this.store.getSummary(topicName);
    return summary?.kind === 'topic' ? summary : null;
  }

  list() {
    return this.store.listSummaries();
  }

  /** `force` regenerates even when the input articles haven't changed. */
  async generate(topicName: string, { force = true } = {}) {
    const articles = selectArticles(await this.store.listArticles(topicName, { take: 50 }), MAX_TOPIC_ARTICLES);
    const hash = inputHash(articles);
    const existing = this.get(topicName);
    if (!force && existing?.inputHash === hash && existing.model === this.currentModel()) return existing;

    let llm: LlmSummary | null = null;
    if (this.generator.enabled && articles.length > 0) {
      try {
        llm = await this.generator.summarize(topicName, 'topic', articles);
      } catch (err) {
        if (!(err instanceof LlmUnavailableError)) throw err;
        this.logger.warn(`topic "${topicName}": ${err.message} — using heuristic summary`);
      }
    }
    return this.store.saveSummary(this.toRecord(topicName, articles, hash, existing, llm));
  }

  async generateAll() {
    const topics = await this.store.listCategories();
    const out = [];
    for (const topic of topics) {
      out.push(await this.generate(topic, { force: false }));
    }
    return out;
  }

  private currentModel() {
    return this.generator.enabled ? this.generator.model : 'heuristic';
  }

  private toRecord(
    topicName: string,
    articles: ArticleRecord[],
    hash: string,
    existing: TopicSummaryRecord | null,
    llm: LlmSummary | null,
  ): TopicSummaryRecord {
    const heuristic = llm ? null : this.heuristic(topicName, articles);
    const baseConfidence = articles.length ? Math.min(0.92, 0.45 + articles.length / 20) : 0.3;
    return {
      id: existing?.id ?? randomUUID(),
      topicName,
      kind: 'topic',
      inputHash: hash,
      model: llm ? this.generator.model : 'heuristic',
      generatedAt: new Date(),
      summary: llm?.summary ?? heuristic!.summary,
      keyPoints: llm?.keyPoints ?? heuristic!.keyPoints,
      sentiment: llm?.sentiment ?? heuristic!.sentiment,
      articleCount: articles.length,
      sourceCount: new Set(articles.map((a) => a.source)).size,
      relatedTopics: llm?.relatedTopics.length ? llm.relatedTopics : ['world', 'tech', 'finance'].filter((t) => t !== topicName),
      trend: articles.length > 8 ? 'rising' : articles.length > 3 ? 'stable' : 'declining',
      confidence: llm ? baseConfidence : baseConfidence * 0.6,
    };
  }

  /** Pre-LLM summary: the leading headlines, kept as the fallback. */
  private heuristic(topicName: string, articles: ArticleRecord[]) {
    const headlines = articles.map((a) => `${a.source}: ${a.headline}`);
    const positive = articles.filter((a) => a.sentiment === 'positive').length;
    const negative = articles.filter((a) => a.sentiment === 'negative').length;
    let sentiment = 'neutral';
    if (positive > negative + 1) sentiment = 'positive';
    if (negative > positive + 1) sentiment = 'negative';
    const keyPoints = headlines.slice(0, 3).map((h) => h.slice(0, 140));
    return {
      summary:
        headlines.length === 0
          ? `No recent coverage for ${topicName}.`
          : `Snapshot of ${topicName}: ${headlines.slice(0, 2).join(' · ')}`,
      keyPoints: keyPoints.length ? keyPoints : ['Coverage is still collecting for this topic.'],
      sentiment,
    };
  }
}
