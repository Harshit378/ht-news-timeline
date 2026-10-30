import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NewsStore } from '../store/news.store';
import { ArticleRecord, TopicSummaryRecord } from '../store/types';
import { SummaryGenerator } from './summary-generator.service';
import { MAX_STORY_ARTICLES, MIN_COMPARE_SOURCES, inputHash, selectArticles } from './summary-prompt';

const MIN_ARTICLES = 3;
const MIN_SOURCES = 2;
/** A brief younger than this is kept even if new reports arrived (no regeneration churn). */
const REFRESH_MIN_AGE_MS = 30 * 60 * 1000;
/** After a failed generation, wait this long before trying the same story again. */
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000;

export interface StoryBriefResponse {
  status: 'ready' | 'pending' | 'unavailable';
  brief?: {
    summary: string;
    keyPoints: string[];
    sentiment: string;
    articleCount: number;
    sourceCount: number;
    generatedAt: string;
    model: string | null;
    /** How the sources' coverage compares; only when ≥ 3 sources (ADR-004). */
    comparison: { commonThemes: string[]; differences: { source: string; point: string }[] } | null;
  };
}

/**
 * AI "What happened" brief per story timeline. Generated in the background the first time a
 * story is viewed (never on the request path), cached by input hash in TopicSummary.
 */
@Injectable()
export class StoryBriefService {
  private readonly logger = new Logger(StoryBriefService.name);
  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly failedAt = new Map<string, number>();

  constructor(
    private readonly store: NewsStore,
    private readonly generator: SummaryGenerator,
  ) {}

  /** Starts generation if needed and returns at once; the promise is only for tests. Never rejects. */
  ensure(key: string, query: string, articles: ArticleRecord[]): Promise<void> {
    if (!this.generator.enabled || this.inFlight.has(key)) return this.inFlight.get(key) ?? Promise.resolve();
    // Wikipedia milestones are context, not reporting: keep them out of the brief and the comparison.
    const reports = articles.filter((a) => a.kind !== 'milestone');
    const selected = selectArticles(reports, MAX_STORY_ARTICLES);
    if (selected.length < MIN_ARTICLES || new Set(selected.map((a) => a.source)).size < MIN_SOURCES) {
      return Promise.resolve();
    }
    const hash = inputHash(selected);
    const existing = this.stored(key);
    const now = Date.now();
    const compare = new Set(selected.map((a) => a.source)).size >= MIN_COMPARE_SOURCES;
    // A brief written before comparison existed is upgraded once, even if its input is unchanged.
    const missingComparison = compare && existing !== null && existing.comparison == null;
    if (existing?.inputHash === hash && existing.model === this.generator.model && !missingComparison) {
      return Promise.resolve();
    }
    if (existing && now - existing.generatedAt.getTime() < REFRESH_MIN_AGE_MS && !missingComparison) {
      return Promise.resolve();
    }
    const failed = this.failedAt.get(key);
    if (failed && now - failed < FAILURE_COOLDOWN_MS) return Promise.resolve();

    const job = this.generate(key, query, selected, hash, existing, compare)
      .catch((err) => {
        this.failedAt.set(key, Date.now());
        this.logger.warn(`brief "${query}" failed: ${err instanceof Error ? err.message : err}`);
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, job);
    return job;
  }

  get(key: string): StoryBriefResponse {
    const brief = this.stored(key);
    if (brief) {
      return {
        status: 'ready',
        brief: {
          summary: brief.summary,
          keyPoints: brief.keyPoints,
          sentiment: brief.sentiment,
          articleCount: brief.articleCount,
          sourceCount: brief.sourceCount,
          generatedAt: brief.generatedAt.toISOString(),
          model: brief.model,
          comparison: brief.comparison ?? null,
        },
      };
    }
    return { status: this.inFlight.has(key) ? 'pending' : 'unavailable' };
  }

  private stored(key: string) {
    const s = this.store.getSummary(key);
    return s?.kind === 'story' ? s : null;
  }

  private async generate(
    key: string,
    query: string,
    articles: ArticleRecord[],
    hash: string,
    existing: TopicSummaryRecord | null,
    compare: boolean,
  ) {
    const result = await this.generator.summarize(query, 'story', articles, { compare });
    // No heuristic stand-in for stories: a list of headlines adds nothing over the timeline itself.
    if (!result) throw new Error('model gave no usable brief');
    const sources = new Set(articles.map((a) => a.source)).size;
    await this.store.saveSummary({
      id: existing?.id ?? randomUUID(),
      topicName: key,
      kind: 'story',
      inputHash: hash,
      model: this.generator.model,
      generatedAt: new Date(),
      summary: result.summary,
      keyPoints: result.keyPoints,
      sentiment: result.sentiment,
      articleCount: articles.length,
      sourceCount: sources,
      relatedTopics: result.relatedTopics,
      trend: 'stable',
      confidence: Math.min(0.9, 0.4 + sources * 0.08 + articles.length * 0.01),
      // Empty (not null) when comparison was asked for but the model gave none, so it isn't retried on every view.
      comparison: compare ? (result.comparison ?? { commonThemes: [], differences: [] }) : null,
    });
    this.failedAt.delete(key);
  }
}
