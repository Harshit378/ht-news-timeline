import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { LlmOutputError, LlmProvider, LlmRequest, LlmStatus, LlmUnavailableError } from './llm-provider';
import { TokenBudget } from './token-budget';

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const EFFORTS = new Set<Effort>(['low', 'medium', 'high', 'xhigh', 'max']);

/** The slice of the SDK client used here, so tests can pass a fake. */
export interface MessagesClient {
  messages: { create(params: Anthropic.MessageCreateParamsNonStreaming, options?: { signal?: AbortSignal }): Promise<Anthropic.Message> };
}

/**
 * Claude via the Anthropic API (ADR-004 cloud provider), selected with `LLM_PROVIDER=anthropic`.
 * The answer is constrained with structured outputs (`output_config.format` = the request's JSON schema).
 * Briefs and summaries are short extraction jobs, so effort defaults to `low`; thinking tokens count
 * against `max_tokens`, hence the floor below.
 */
export class AnthropicProvider implements LlmProvider {
  readonly id = 'anthropic';
  readonly model: string;
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly effort: Effort;
  private readonly client: MessagesClient | null;
  private readonly configError: string | null;
  /** Last credential/config failure; reported by status() until a call succeeds. */
  private authError: string | null = null;
  readonly budget: TokenBudget;

  constructor(env: NodeJS.ProcessEnv = process.env, client?: MessagesClient) {
    this.model = env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
    const effort = (env.ANTHROPIC_EFFORT || 'low') as Effort;
    this.effort = EFFORTS.has(effort) ? effort : 'low';
    this.budget = new TokenBudget(Number(env.LLM_DAILY_TOKEN_LIMIT ?? 2_000_000));
    let created: MessagesClient | null = client ?? null;
    let configError: string | null = null;
    if (!created) {
      try {
        // Credentials come from ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile.
        created = new Anthropic({ timeout: Number(env.LLM_TIMEOUT_MS) || 60_000, maxRetries: 2 });
      } catch (err) {
        configError = `Anthropic client not configured: ${err instanceof Error ? err.message : err}`;
      }
    }
    this.client = created;
    this.configError = configError;
  }

  async generateJson(req: LlmRequest): Promise<unknown> {
    if (!this.client) throw new LlmUnavailableError(this.configError ?? 'not configured');
    if (this.budget.exhausted) {
      throw new LlmUnavailableError(`daily token budget used (${this.budget.limit.toLocaleString()} tokens)`);
    }

    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: Math.max(4096, req.maxTokens ?? 0),
          output_config: { effort: this.effort, format: { type: 'json_schema', schema: req.schema as Record<string, unknown> } },
          system: req.system,
          messages: [{ role: 'user', content: req.prompt }],
        },
        { signal: req.signal },
      );
    } catch (err) {
      throw this.toLlmError(err);
    }

    this.authError = null;
    this.budget.add((response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0));

    if (response.stop_reason === 'refusal') throw new LlmOutputError('model declined the request');
    if (response.stop_reason === 'max_tokens') throw new LlmOutputError('response was cut off (max_tokens)');
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    if (!text.trim()) throw new LlmOutputError('empty response');
    try {
      return JSON.parse(text);
    } catch {
      throw new LlmOutputError('response was not valid JSON');
    }
  }

  async status(): Promise<LlmStatus> {
    // No request here: a status check shouldn't spend tokens.
    if (!this.client) return { id: this.id, model: this.model, state: 'down', detail: this.configError ?? undefined };
    if (this.authError) return { id: this.id, model: this.model, state: 'down', detail: this.authError };
    if (this.budget.exhausted) {
      return { id: this.id, model: this.model, state: 'down', detail: 'daily token budget used' };
    }
    return {
      id: this.id,
      model: this.model,
      state: 'ok',
      detail: `${this.budget.usedToday.toLocaleString()} / ${this.budget.limit.toLocaleString()} tokens today`,
    };
  }

  private toLlmError(err: unknown): Error {
    let message: string;
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      message = 'Anthropic rejected the API key';
      this.authError = message;
    } else if (err instanceof Anthropic.RateLimitError) {
      message = 'Anthropic rate limit hit';
    } else if (err instanceof Anthropic.BadRequestError) {
      // Our request was wrong (e.g. schema not accepted): retrying won't help, so surface it loudly.
      this.logger.error(`Anthropic rejected the request: ${err.message}`);
      return new LlmOutputError(`request rejected: ${err.message}`);
    } else if (err instanceof Anthropic.APIConnectionTimeoutError) {
      message = 'Anthropic request timed out';
    } else if (err instanceof Anthropic.APIConnectionError) {
      message = 'Anthropic not reachable';
    } else if (err instanceof Anthropic.APIError) {
      message = `Anthropic HTTP ${err.status}`;
    } else {
      // e.g. no credentials found at request time (no key, token or `ant auth login` profile).
      message = err instanceof Error ? err.message : String(err);
      this.authError = message;
    }
    this.logger.warn(message);
    return new LlmUnavailableError(message);
  }
}
