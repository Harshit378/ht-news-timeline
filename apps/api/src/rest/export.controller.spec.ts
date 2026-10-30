import { describe, expect, it, vi } from 'vitest';
import { ExportController } from './export.controller';

describe('ExportController (ADR-007)', () => {
  const sampleArticle = {
    id: 'art_1',
    headline: 'Major Discovery in Space',
    source: 'NASA',
    publishedAt: new Date('2026-10-31T00:00:00Z'),
    url: 'https://nasa.gov/news/1',
    excerpt: 'Telescope finds evidence of water on distant exoplanet.',
    importance: 'high',
  };

  const fakeStore = {
    searchArticles: vi.fn(async () => [sampleArticle]),
    listArticles: vi.fn(async () => [sampleArticle]),
  };

  const controller = new ExportController(fakeStore as never);

  it('exports story timeline in markdown format', async () => {
    const res = await controller.exportDigest({ query: 'space', format: 'markdown' });
    expect(res.format).toBe('markdown');
    expect(res.digest).toContain('# Timeline Digest: space');
    expect(res.digest).toContain('### Major Discovery in Space');
    expect(res.digest).toContain('NASA');
  });

  it('exports category timeline in json format', async () => {
    const res = await controller.exportDigest({ category: 'science', format: 'json' });
    expect(res.totalArticles).toBe(1);
    expect(res.articles[0].headline).toBe('Major Discovery in Space');
  });
});
