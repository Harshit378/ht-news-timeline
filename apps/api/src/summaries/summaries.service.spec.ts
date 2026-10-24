import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { LlmUnavailableError } from '../llm/llm-provider';
import type { ArticleRecord, TopicSummaryRecord } from '../store/types';
import { SummariesService } from './summaries.service';

const art = (id: string, source: string): ArticleRecord => ({
  id, headline: `Headline ${id}`, excerpt: 'x', body: null, source, sourceDomain: null, url: null, category: 'sports',
  publishedAt: new Date('2026-10-24T00:00:00Z'), imageUrl: null, sentiment: null, bias: null, importance: 'normal',
  storyClusterId: null, tone: null,
});

function setup(summarize: ReturnType<typeof vi.fn>, enabled = true) {
  const saved = new Map<string, TopicSummaryRecord>();
  const store = {
    listArticles: vi.fn(async () => [art('a', 'ESPN'), art('b', 'BBC')]),
    listCategories: vi.fn(async () => ['sports']),
    getSummary: (t: string) => saved.get(t) ?? null,
    saveSummary: vi.fn(async (s: TopicSummaryRecord) => (saved.set(s.topicName, s), s)),
  };
  const generator = { enabled, model: 'llama3.2', summarize };
  return { svc: new SummariesService(store as never, generator as never), store, saved };
}

describe('SummariesService', () => {
  it('writes topic summaries with the LLM', async () => {
    const { svc } = setup(vi.fn(async () => ({ summary: 'LLM text', keyPoints: ['a', 'b'], sentiment: 'neutral', relatedTopics: ['mlb'] })));
    expect(await svc.generate('sports')).toMatchObject({ kind: 'topic', model: 'llama3.2', summary: 'LLM text', relatedTopics: ['mlb'] });
  });

  it('falls back to the heuristic when the LLM is unavailable', async () => {
    const { svc } = setup(vi.fn(async () => Promise.reject(new LlmUnavailableError('down'))));
    const out = await svc.generate('sports');
    expect(out).toMatchObject({ model: 'heuristic' });
    expect(out.summary).toContain('Snapshot of sports');
  });

  it('skips unchanged topics on the cron run', async () => {
    const summarize = vi.fn(async () => ({ summary: 'LLM text', keyPoints: ['a', 'b'], sentiment: 'neutral', relatedTopics: [] }));
    const { svc } = setup(summarize);
    await svc.generateAll();
    await svc.generateAll();
    expect(summarize).toHaveBeenCalledTimes(1);
  });
});
