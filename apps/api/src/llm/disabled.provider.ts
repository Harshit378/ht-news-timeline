import { LlmProvider, LlmStatus, LlmUnavailableError } from './llm-provider';

/** `LLM_PROVIDER=none` (or an unknown value): summaries use the heuristic, story briefs are off. */
export class DisabledProvider implements LlmProvider {
  readonly id = 'none';
  readonly model = 'none';

  constructor(private readonly reason = 'LLM_PROVIDER=none') {}

  async generateJson(): Promise<unknown> {
    throw new LlmUnavailableError(this.reason);
  }

  async status(): Promise<LlmStatus> {
    return { id: this.id, model: this.model, state: 'disabled', detail: this.reason };
  }
}
