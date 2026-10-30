import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_PROVIDER, LlmOutputError, LlmProvider } from '../llm/llm-provider';
import { ArticleRecord } from '../store/types';
import { STORY_COMPARE_SCHEMA, SUMMARY_SCHEMA, buildSummaryPrompt } from './summary-prompt';
import { LlmSummary, validateSummary } from './summary-validate';

/** Prompt → model → validated JSON, with one retry on unusable output. */
@Injectable()
export class SummaryGenerator {
  private readonly logger = new Logger(SummaryGenerator.name);

  constructor(@Inject(LLM_PROVIDER) private readonly llm: LlmProvider) {}

  get model() {
    return this.llm.model;
  }

  get enabled() {
    return this.llm.id !== 'none';
  }

  /** Throws LlmUnavailableError when the provider is down; null when it answers unusably twice. */
  async summarize(
    subject: string,
    kind: 'story' | 'topic',
    articles: ArticleRecord[],
    opts: { compare?: boolean } = {},
  ): Promise<LlmSummary | null> {
    const compare = kind === 'story' && opts.compare === true;
    const { system, prompt } = buildSummaryPrompt(subject, kind, articles, compare);
    const schema = compare ? STORY_COMPARE_SCHEMA : SUMMARY_SCHEMA;
    const sources = compare ? [...new Set(articles.map((a) => a.source))] : undefined;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const started = Date.now();
      try {
        const result = validateSummary(
          await this.llm.generateJson({ system, prompt, schema, maxTokens: compare ? 900 : undefined }),
          sources,
        );
        if (result) {
          this.logger.log(`${kind} "${subject}" summarised by ${this.llm.model} in ${Date.now() - started}ms`);
          return result;
        }
        this.logger.warn(`${kind} "${subject}": unusable summary (attempt ${attempt})`);
      } catch (err) {
        if (!(err instanceof LlmOutputError)) throw err;
        this.logger.warn(`${kind} "${subject}": ${err.message} (attempt ${attempt})`);
      }
    }
    return null;
  }
}
