import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TierGuard, RequiresTier } from '../auth/tier.guard';
import { NewsStore } from '../store/news.store';

@Controller('export')
@UseGuards(TierGuard)
export class ExportController {
  constructor(private readonly store: NewsStore) {}

  @Post('digest')
  @RequiresTier('PRO')
  async exportDigest(
    @Body()
    body: {
      query?: string;
      category?: string;
      format?: 'markdown' | 'json' | 'text';
    },
  ) {
    const q = body.query?.trim();
    const category = body.category?.trim();
    const format = body.format || 'markdown';

    if (!q && !category) {
      throw new BadRequestException('Either query or category must be specified');
    }

    const articles = q
      ? await this.store.searchArticles(q)
      : await this.store.listArticles(category, { skip: 0, take: 50 });

    if (format === 'json') {
      return {
        exportedAt: new Date().toISOString(),
        title: q ? `Timeline Digest: ${q}` : `Category Digest: ${category}`,
        totalArticles: articles.length,
        articles: articles.map((a) => ({
          headline: a.headline,
          source: a.source,
          publishedAt: a.publishedAt,
          url: a.url,
          excerpt: a.excerpt,
          importance: a.importance,
        })),
      };
    }

    if (format === 'markdown') {
      const title = q ? `# Timeline Digest: ${q}` : `# Category Digest: ${category}`;
      const header = `${title}\n\n*Generated on ${new Date().toUTCString()} · ${articles.length} reports*\n\n---\n`;
      const rows = articles
        .map(
          (a) =>
            `### ${a.headline}\n**Source:** ${a.source} · **Date:** ${new Date(a.publishedAt).toISOString().slice(0, 10)}\n\n> ${a.excerpt}\n\n[Read original article](${a.url || '#'})\n`,
        )
        .join('\n---\n\n');
      return {
        format: 'markdown',
        digest: header + rows,
      };
    }

    // plain text
    const textLines = [
      q ? `TIMELINE DIGEST: ${q}` : `CATEGORY DIGEST: ${category}`,
      `Generated: ${new Date().toISOString()}`,
      `Total: ${articles.length} reports`,
      '==================================================',
      ...articles.map(
        (a) =>
          `[${new Date(a.publishedAt).toISOString().slice(0, 10)}] ${a.headline} (${a.source})\n${a.excerpt}\n${a.url || ''}\n`,
      ),
    ];
    return {
      format: 'text',
      digest: textLines.join('\n'),
    };
  }
}
