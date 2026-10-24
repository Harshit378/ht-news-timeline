export interface LlmRequest {
  system: string;
  prompt: string;
  /** JSON schema the answer must follow; providers enforce it natively where they can. */
  schema: object;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LlmStatus {
  id: string;
  model: string;
  state: 'ok' | 'down' | 'disabled';
  detail?: string;
}

/**
 * A text model behind one interface (ADR-004) so the backend can move from local Ollama to a
 * cloud provider (Gemini, Claude, OpenAI) by changing `LLM_PROVIDER`, not service code.
 */
export interface LlmProvider {
  readonly id: string;
  readonly model: string;
  /** The model's parsed JSON answer (still unvalidated — callers check its shape). */
  generateJson(req: LlmRequest): Promise<unknown>;
  status(): Promise<LlmStatus>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

/** The provider can't be reached or isn't configured; callers fall back or skip. */
export class LlmUnavailableError extends Error {}

/** The provider answered, but not with usable JSON. */
export class LlmOutputError extends Error {}
