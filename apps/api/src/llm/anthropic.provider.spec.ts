import { describe, expect, it, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicProvider, type MessagesClient } from './anthropic.provider';
import { createLlmProvider } from './llm.module';
import { LlmOutputError, LlmUnavailableError } from './llm-provider';
import { TokenBudget } from './token-budget';

const SCHEMA = { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'], additionalProperties: false };
const REQ = { system: 'sys', prompt: 'reports', schema: SCHEMA, maxTokens: 500 };

function message(text: string, extra: Partial<Anthropic.Message> = {}): Anthropic.Message {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [{ type: 'text', text, citations: null }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1200, output_tokens: 300 },
    ...extra,
  } as Anthropic.Message;
}

function fakeClient(impl: () => Promise<Anthropic.Message>) {
  const create = vi.fn(impl);
  return { client: { messages: { create } } as unknown as MessagesClient, create };
}

describe('AnthropicProvider', () => {
  it('sends the schema as structured output and parses the JSON answer', async () => {
    const { client, create } = fakeClient(async () => message('{"summary":"ok"}'));
    const p = new AnthropicProvider({}, client);
    await expect(p.generateJson(REQ)).resolves.toEqual({ summary: 'ok' });
    const params = create.mock.calls[0][0] as Anthropic.MessageCreateParamsNonStreaming;
    expect(params.model).toBe('claude-haiku-5-5');
    expect(params.output_config).toEqual({ effort: 'low', format: { type: 'json_schema', schema: SCHEMA } });
    expect(params.system).toBe('sys');
    expect(params.max_tokens).toBeGreaterThanOrEqual(4096); // thinking tokens count against it
    expect(params).not.toHaveProperty('temperature');
  });

  it('honours ANTHROPIC_MODEL and ANTHROPIC_EFFORT', async () => {
    const { client, create } = fakeClient(async () => message('{"summary":"ok"}'));
    await new AnthropicProvider({ ANTHROPIC_MODEL: 'claude-sonnet-5-5', ANTHROPIC_EFFORT: 'medium' }, client).generateJson(REQ);
    const params = create.mock.calls[0][0] as Anthropic.MessageCreateParamsNonStreaming;
    expect(params.model).toBe('claude-sonnet-5-5');
    expect(params.output_config?.effort).toBe('medium');
  });

  it('maps refusals, truncation and bad JSON to LlmOutputError', async () => {
    for (const msg of [
      message('', { stop_reason: 'refusal' }),
      message('{"summ', { stop_reason: 'max_tokens' }),
      message('not json'),
    ]) {
      const { client } = fakeClient(async () => msg);
      await expect(new AnthropicProvider({}, client).generateJson(REQ)).rejects.toBeInstanceOf(LlmOutputError);
    }
  });

  it('maps API failures to LlmUnavailableError (callers fall back)', async () => {
    const errors = [
      new Anthropic.RateLimitError(429, {}, 'slow down', new Headers()),
      new Anthropic.InternalServerError(529, {}, 'overloaded', new Headers()),
      new Anthropic.APIConnectionTimeoutError(),
      new Anthropic.APIConnectionError({ message: 'ECONNREFUSED' }),
    ];
    for (const err of errors) {
      const { client } = fakeClient(async () => {
        throw err;
      });
      await expect(new AnthropicProvider({}, client).generateJson(REQ)).rejects.toBeInstanceOf(LlmUnavailableError);
    }
  });

  it('reports a rejected key in status until a call succeeds', async () => {
    let fail = true;
    const { client } = fakeClient(async () => {
      if (fail) throw new Anthropic.AuthenticationError(401, {}, 'invalid x-api-key', new Headers());
      return message('{"summary":"ok"}');
    });
    const p = new AnthropicProvider({}, client);
    await expect(p.generateJson(REQ)).rejects.toBeInstanceOf(LlmUnavailableError);
    expect((await p.status()).state).toBe('down');
    fail = false;
    await p.generateJson(REQ);
    expect((await p.status()).state).toBe('ok');
  });

  it('stops calling the API once the daily token budget is used', async () => {
    const { client, create } = fakeClient(async () => message('{"summary":"ok"}')); // 1,500 tokens per call
    const p = new AnthropicProvider({ LLM_DAILY_TOKEN_LIMIT: '2000' }, client);
    await p.generateJson(REQ);
    await p.generateJson(REQ); // 3,000 used now
    await expect(p.generateJson(REQ)).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(create).toHaveBeenCalledTimes(2);
    expect((await p.status()).detail).toContain('budget');
  });

  it('is selected by LLM_PROVIDER=anthropic', () => {
    expect(createLlmProvider({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test' }).id).toBe('anthropic');
  });
});

describe('TokenBudget', () => {
  it('resets at the start of each UTC day', () => {
    let now = new Date('2026-10-25T23:59:00Z');
    const b = new TokenBudget(100, () => now);
    b.add(150);
    expect(b.exhausted).toBe(true);
    now = new Date('2026-10-26T00:00:01Z');
    expect(b.exhausted).toBe(false);
    expect(b.usedToday).toBe(0);
  });

  it('treats a limit of 0 as unlimited', () => {
    const b = new TokenBudget(0);
    b.add(1e9);
    expect(b.exhausted).toBe(false);
  });
});
