import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { LlmUnavailableError } from '../llm/llm-provider';
import type { ArticleRecord, TopicSummaryRecord } from '../store/types';
import { StoryBriefService } from './story-brief.service';

function rec(id: string, source: string): ArticleRecord {
  return {
    id, headline: `Headline ${id}`, excerpt: `Excerpt ${id}`, body: null, source, sourceDomain: null, url: null,
    category: 'sports', publishedAt: new Date('2026-10-24T00:00:00Z'), imageUrl: null, sentiment: null, bias: null,
    importance: 'normal', storyClusterId: null, tone: null,
  };
}

const three = [rec('a', 'ESPN'), rec('b', 'BBC'), rec('c', 'NPR')];
const llmResult = { summary: 'What happened.', keyPoints: ['one', 'two'], sentiment: 'neutral', relatedTopics: [] };

function setup(summarize = vi.fn(async () => llmResult), enabled = true) {
  const summaries = new Map<string, TopicSummaryRecord>();
  const store = {
    getSummary: (k: string) => summaries.get(k) ?? null,
    saveSummary: vi.fn(async (s: TopicSummaryRecord) => summaries.set(s.topicName, s)),
  };
  const generator = { enabled, model: 'llama3.2', summarize };
  return { svc: new StoryBriefService(store as never, generator as never), store, summarize, summaries };
}

describe('StoryBriefService', () => {
  it('needs at least 3 reports from 2 sources', async () => {
    const { svc, summarize } = setup();
    await svc.ensure('k|', 'k', [rec('a', 'ESPN'), rec('b', 'ESPN'), rec('c', 'ESPN')]);
    expect(summarize).not.toHaveBeenCalled();
    expect(svc.get('k|').status).toBe('unavailable');
  });

  it('is pending while generating, then ready, and stored as a story brief', async () => {
    let release!: () => void;
    const { svc, summaries } = setup(vi.fn(() => new Promise<typeof llmResult>((r) => (release = () => r(llmResult)))));
    const job = svc.ensure('mlb|', 'MLB', three);
    expect(svc.get('mlb|').status).toBe('pending');
    release();
    await job;
    const res = svc.get('mlb|');
    expect(res).toMatchObject({ status: 'ready', brief: { summary: 'What happened.', sourceCount: 3, model: 'llama3.2' } });
    expect(summaries.get('mlb|')).toMatchObject({ kind: 'story', model: 'llama3.2' });
    expect(summaries.get('mlb|')?.inputHash).toBeTruthy();
  });

  it('runs once for concurrent calls and not again for the same input', async () => {
    const { svc, summarize } = setup();
    await Promise.all([svc.ensure('k|', 'k', three), svc.ensure('k|', 'k', three)]);
    await svc.ensure('k|', 'k', [...three].reverse());
    expect(summarize).toHaveBeenCalledTimes(1);
  });

  it('keeps a recent brief when new reports arrive', async () => {
    const { svc, summarize } = setup();
    await svc.ensure('k|', 'k', three);
    await svc.ensure('k|', 'k', [...three, rec('d', 'AP')]);
    expect(summarize).toHaveBeenCalledTimes(1);
  });

  it('backs off after a failure and reports unavailable', async () => {
    const summarize = vi.fn(async () => Promise.reject(new LlmUnavailableError('down')));
    const { svc } = setup(summarize);
    await svc.ensure('k|', 'k', three);
    await svc.ensure('k|', 'k', three);
    expect(summarize).toHaveBeenCalledTimes(1);
    expect(svc.get('k|').status).toBe('unavailable');
  });

  it('stores nothing when the model gives no usable brief', async () => {
    const { svc, store } = setup(vi.fn(async () => null));
    await svc.ensure('k|', 'k', three);
    expect(store.saveSummary).not.toHaveBeenCalled();
    expect(svc.get('k|').status).toBe('unavailable');
  });

  it('does nothing when the provider is disabled', async () => {
    const { svc, summarize } = setup(undefined, false);
    await svc.ensure('k|', 'k', three);
    expect(summarize).not.toHaveBeenCalled();
  });
});

describe('StoryBriefService source comparison', () => {
  const comparison = { commonThemes: ['Game 7 result'], differences: [{ source: 'BBC', point: 'BBC alone notes the attendance record.' }] };

  it('asks for a comparison with 3+ sources and returns it with the brief', async () => {
    const { svc, summarize } = setup(vi.fn(async () => ({ ...llmResult, comparison })));
    await svc.ensure('k|', 'k', three);
    expect(summarize).toHaveBeenCalledWith('k', 'story', expect.any(Array), { compare: true });
    expect(svc.get('k|').brief?.comparison).toEqual(comparison);
  });

  it('does not ask with only 2 sources', async () => {
    const { svc, summarize } = setup();
    await svc.ensure('k|', 'k', [rec('a', 'ESPN'), rec('b', 'BBC'), rec('c', 'BBC')]);
    expect(summarize).toHaveBeenCalledWith('k', 'story', expect.any(Array), { compare: false });
    expect(svc.get('k|').brief?.comparison).toBeNull();
  });

  it('upgrades a brief written before comparison existed, once', async () => {
    const { svc, summarize, summaries } = setup(vi.fn(async () => llmResult)); // model gives no comparison
    await svc.ensure('k|', 'k', three);
    summaries.set('k|', { ...summaries.get('k|')!, comparison: null }); // as stored by an older version
    await svc.ensure('k|', 'k', three);
    expect(summarize).toHaveBeenCalledTimes(2);
    expect(summaries.get('k|')?.comparison).toEqual({ commonThemes: [], differences: [] });
    await svc.ensure('k|', 'k', three);
    expect(summarize).toHaveBeenCalledTimes(2);
  });
});

describe('StoryBriefService with Wikipedia milestones', () => {
  it('leaves milestones out of the brief input', async () => {
    const { svc, summarize } = setup();
    const milestones = ['m1', 'm2', 'm3'].map((id) => ({ ...rec(id, 'Wikipedia'), kind: 'milestone' }));
    await svc.ensure('k|', 'k', [rec('a', 'ESPN'), ...milestones]);
    expect(summarize).not.toHaveBeenCalled(); // 1 report from 1 source is not enough on its own
    await svc.ensure('k2|', 'k2', [...three, ...milestones]);
    const passed = (summarize.mock.calls[0] as unknown[])[2] as { kind?: string }[];
    expect(passed.every((a) => a.kind !== 'milestone')).toBe(true);
  });
});
