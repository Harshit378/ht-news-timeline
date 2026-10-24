import axios, { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlmOutputError, LlmUnavailableError } from './llm-provider';
import { createLlmProvider } from './llm.module';
import { OllamaProvider } from './ollama.provider';

afterEach(() => vi.restoreAllMocks());

const req = { system: 'sys', prompt: 'p', schema: { type: 'object' } };
const reply = (content: string) => ({ data: { message: { content } } });

describe('OllamaProvider', () => {
  const env = { OLLAMA_URL: 'http://ollama.test:11434/', OLLAMA_MODEL: 'llama3.2', LLM_TIMEOUT_MS: '5000' };

  it('calls /api/chat with structured output, no streaming and keep_alive', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValueOnce(reply('{"ok":true}'));
    expect(await new OllamaProvider(env).generateJson(req)).toEqual({ ok: true });
    const [url, body, config] = post.mock.calls[0] as [string, Record<string, unknown>, Record<string, unknown>];
    expect(url).toBe('http://ollama.test:11434/api/chat');
    expect(body).toMatchObject({ model: 'llama3.2', stream: false, format: req.schema, keep_alive: '30m' });
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'p' },
    ]);
    expect(config.timeout).toBe(5000);
  });

  it('runs one generation at a time', async () => {
    let active = 0;
    let maxActive = 0;
    vi.spyOn(axios, 'post').mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return reply('{}');
    });
    const p = new OllamaProvider(env);
    await Promise.all([p.generateJson(req), p.generateJson(req), p.generateJson(req)]);
    expect(maxActive).toBe(1);
  });

  it('keeps the queue going after a failed call', async () => {
    vi.spyOn(axios, 'post').mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(reply('{"n":2}'));
    const p = new OllamaProvider(env);
    await expect(p.generateJson(req)).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(await p.generateJson(req)).toEqual({ n: 2 });
  });

  it('maps unreachable / missing model to LlmUnavailableError and bad JSON to LlmOutputError', async () => {
    const headers = new AxiosHeaders();
    const notFound = new AxiosError('nf', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 404, statusText: 'Not Found', headers, config: { headers }, data: {},
    });
    const refused = Object.assign(new AxiosError('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    vi.spyOn(axios, 'post')
      .mockRejectedValueOnce(notFound)
      .mockRejectedValueOnce(refused)
      .mockResolvedValueOnce(reply('not json'));
    const p = new OllamaProvider(env);
    await expect(p.generateJson(req)).rejects.toThrow('ollama pull llama3.2');
    await expect(p.generateJson(req)).rejects.toThrow('not reachable');
    await expect(p.generateJson(req)).rejects.toBeInstanceOf(LlmOutputError);
  });

  it('reports status from /api/tags: ok when the model is pulled, down otherwise', async () => {
    vi.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: { models: [{ name: 'llama3.2:latest' }] } })
      .mockResolvedValueOnce({ data: { models: [{ name: 'qwen2.5:7b' }] } });
    expect((await new OllamaProvider(env).status()).state).toBe('ok');
    const missing = await new OllamaProvider(env).status();
    expect(missing).toMatchObject({ state: 'down' });
    expect(missing.detail).toContain('ollama pull llama3.2');
  });
});

describe('createLlmProvider', () => {
  it('defaults to Ollama and disables on none or unknown values', async () => {
    expect(createLlmProvider({}).id).toBe('ollama');
    expect((await createLlmProvider({ LLM_PROVIDER: 'none' }).status()).state).toBe('disabled');
    const unknown = createLlmProvider({ LLM_PROVIDER: 'gpt9' });
    await expect(unknown.generateJson(req)).rejects.toBeInstanceOf(LlmUnavailableError);
  });
});
