import { describe, expect, it, vi } from 'vitest';
import { FeedController } from './feed.controller';

describe('FeedController (ADR-007 Sponsored Cards & ADR-009 Region)', () => {
  const dummyArticles = Array.from({ length: 10 }, (_, i) => ({
    id: `art_${i}`,
    headline: `Headline ${i}`,
    excerpt: `Excerpt ${i}`,
    body: `Body ${i}`,
    source: 'BBC News',
    sourceDomain: 'bbc.co.uk',
    url: `https://bbc.com/${i}`,
    category: 'world',
    publishedAt: new Date(Date.now() - i * 60_000),
    imageUrl: null,
    sentiment: 'neutral',
    bias: 'center',
    importance: 'normal',
    storyClusterId: null,
    tone: 0,
    inFeed: true,
    kind: 'report',
    region: 'GB',
  }));

  const fakeStore = {
    listArticles: vi.fn(async () => dummyArticles),
  };

  it('injects sponsored card for anonymous readers', async () => {
    const ctrl = new FeedController(fakeStore as never);
    const res = await ctrl.getFeed();
    expect(res.items.length).toBe(11); // 10 articles + 1 sponsor card
    const sponsorCard = res.items.find((item: { kind?: string }) => item.kind === 'sponsored');
    expect(sponsorCard).toBeDefined();
    expect(sponsorCard.headline || sponsorCard.title).toContain('Upgrade to Pro');
  });

  it('omits sponsored card for PRO and TEAM subscribers', async () => {
    const fakeAuthService = {
      validateTokenOrHeader: vi.fn(async () => ({ tier: 'PRO' })),
    };
    const ctrl = new FeedController(fakeStore as never, fakeAuthService as never);
    const res = await ctrl.getFeed(undefined, '1', undefined, { authorization: 'Bearer test' });
    expect(res.items.length).toBe(10); // Exactly 10, no sponsor card
    const sponsorCard = res.items.find((item: { kind?: string }) => item.kind === 'sponsored');
    expect(sponsorCard).toBeUndefined();
  });
});
