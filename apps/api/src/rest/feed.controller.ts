import { Controller, Get, Headers, Optional, Query } from '@nestjs/common';
import { NewsStore } from '../store/news.store';
import { extractCoarseRegion } from '../store/region';
import { serializeArticle } from './serialize';
import { AuthService } from '../auth/auth.service';

function createSponsoredCard(page: number, category?: string) {
  return {
    id: `sponsored-p${page}`,
    title: 'Support Independent News Chronology · Upgrade to Pro',
    excerpt: 'Enjoy ad-free reading, cloud bookmark sync across devices, and instant AI story briefs.',
    source: 'Sponsored · News Timeline',
    category: category ?? 'world',
    publishedAt: new Date().toISOString(),
    isBreaking: false,
    body: 'Upgrade to Pro for ad-free chronological reading, cross-device bookmark backup, and AI topic summaries.',
    imageUrl: '',
    thumbnailEmoji: '✨',
    tags: ['sponsored', 'pro'],
    readTimeMinutes: 1,
    url: 'https://htimeline.com/pro',
    kind: 'sponsored' as const,
    importance: 'normal' as const,
  };
}

@Controller('feed')
export class FeedController {
  constructor(
    private readonly store: NewsStore,
    @Optional() private readonly authService?: AuthService,
  ) {}

  @Get()
  async getFeed(
    @Query('category') category?: string,
    @Query('page') page = '1',
    @Query('region') region?: string,
    @Headers() headers: Record<string, string | string[] | undefined> = {},
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = 20;
    const resolvedRegion = extractCoarseRegion(headers, region);
    // Fetch one extra row to learn whether another page exists without a COUNT.
    const rows = await this.store.listArticles(category, {
      skip: (pageNum - 1) * pageSize,
      take: pageSize + 1,
      // ADR-009: the reader's region ranks higher; unknown values are ignored rather than rejected.
      region: resolvedRegion,
    });

    const token =
      (typeof headers.authorization === 'string' ? headers.authorization : undefined) ||
      (typeof headers['x-api-key'] === 'string' ? headers['x-api-key'] : undefined) ||
      (typeof headers['x-user-id'] === 'string' ? headers['x-user-id'] : undefined);

    const user = this.authService ? await this.authService.validateTokenOrHeader(token) : null;
    const isPayingSubscriber = user?.tier === 'PRO' || user?.tier === 'TEAM';

    const items = rows.slice(0, pageSize).map(serializeArticle);

    // ADR-007: Non-intrusive native sponsor card for Free readers; omitted for Pro/Team subscribers
    if (!isPayingSubscriber && items.length >= 3) {
      items.splice(3, 0, createSponsoredCard(pageNum, category) as never);
    }

    return {
      category: category ?? null,
      region: resolvedRegion,
      items,
      page: pageNum,
      pageSize,
      hasMore: rows.length > pageSize,
    };
  }
}
