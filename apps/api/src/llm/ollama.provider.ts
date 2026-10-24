import { Logger } from '@nestjs/common';
import axios from 'axios';
import { LlmOutputError, LlmProvider, LlmRequest, LlmStatus, LlmUnavailableError } from './llm-provider';

const STATUS_TTL_MS = 30_000;

/**
 * Local model via Ollama's /api/chat with structured output (`format` = JSON schema).
 * Generations run one at a time: a local model on a laptop shouldn't run several at once.
 */
export class OllamaProvider implements LlmProvider {
  readonly id = 'ollama';
  readonly model: string;
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private queue: Promise<unknown> = Promise.resolve();
  private cachedStatus?: { at: number; value: LlmStatus };

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.baseUrl = (env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
    this.model = env.OLLAMA_MODEL || 'llama3.2';
    this.timeoutMs = Number(env.LLM_TIMEOUT_MS) || 120_000;
  }

  generateJson(req: LlmRequest): Promise<unknown> {
    const run = () => this.chat(req);
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  async status(): Promise<LlmStatus> {
    if (this.cachedStatus && Date.now() - this.cachedStatus.at < STATUS_TTL_MS) return this.cachedStatus.value;
    let value: LlmStatus;
    try {
      const { data } = await axios.get<{ models?: { name: string }[] }>(`${this.baseUrl}/api/tags`, { timeout: 3000 });
      const pulled = (data.models ?? []).some((m) => m.name === this.model || m.name === `${this.model}:latest`);
      value = pulled
        ? { id: this.id, model: this.model, state: 'ok' }
        : { id: this.id, model: this.model, state: 'down', detail: `model not pulled — run \`ollama pull ${this.model}\`` };
    } catch {
      value = { id: this.id, model: this.model, state: 'down', detail: `Ollama not reachable at ${this.baseUrl}` };
    }
    this.cachedStatus = { at: Date.now(), value };
    return value;
  }

  private async chat(req: LlmRequest): Promise<unknown> {
    let content: unknown;
    try {
      const { data } = await axios.post(
        `${this.baseUrl}/api/chat`,
        {
          model: this.model,
          stream: false,
          format: req.schema,
          // The first call loads the model (10–30 s); keep it resident between briefs.
          keep_alive: '30m',
          options: { temperature: 0.2, num_ctx: 4096, num_predict: req.maxTokens ?? 500 },
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.prompt },
          ],
        },
        { timeout: this.timeoutMs, signal: req.signal },
      );
      content = data?.message?.content;
    } catch (err) {
      this.cachedStatus = undefined;
      const message = axios.isAxiosError(err)
        ? err.response?.status === 404
          ? `model ${this.model} not pulled — run \`ollama pull ${this.model}\``
          : err.response
            ? `Ollama HTTP ${err.response.status}`
            : `Ollama not reachable (${err.code ?? err.message})`
        : String(err);
      this.logger.warn(message);
      throw new LlmUnavailableError(message);
    }
    if (typeof content !== 'string' || !content.trim()) throw new LlmOutputError('empty response');
    try {
      return JSON.parse(content);
    } catch {
      throw new LlmOutputError('response was not valid JSON');
    }
  }
}
