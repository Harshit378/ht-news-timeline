import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { NewsStore } from '../store/news.store';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BOOKMARKS = 1000;

/**
 * Until accounts exist (ADR-007), bookmarks belong to an anonymous per-device UUID (ADR-006).
 * 'local' is still accepted for older clients.
 */
export function parseUserId(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return 'local';
  if (raw === 'local' || (typeof raw === 'string' && UUID.test(raw))) return raw.toLowerCase();
  throw new BadRequestException('userId must be a device UUID');
}

export function parseArticleIds(raw: unknown): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.some((id) => typeof id !== 'string' || !id || id.length > 200)) {
    throw new BadRequestException('articleIds must be an array of article ids');
  }
  if (raw.length > MAX_BOOKMARKS) throw new BadRequestException(`at most ${MAX_BOOKMARKS} bookmarks`);
  return [...new Set(raw as string[])];
}

function parseArticleId(raw: unknown): string {
  if (typeof raw !== 'string' || !raw || raw.length > 200) throw new BadRequestException('articleId is required');
  return raw;
}

@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly store: NewsStore) {}

  @Get()
  async findAll(@Query('userId') userId?: string) {
    return { items: await this.store.listBookmarks(parseUserId(userId)) };
  }

  /** Replaces the device's whole set (idempotent), so a retried or duplicated sync is harmless. */
  @Put()
  put(@Body() body: { articleIds?: unknown; userId?: unknown }) {
    return this.store.putBookmarks(parseArticleIds(body?.articleIds), parseUserId(body?.userId));
  }

  @Post()
  async create(@Body() body: { articleId?: unknown; userId?: unknown }) {
    const userId = parseUserId(body?.userId);
    const articleId = parseArticleId(body?.articleId);
    const current = (await this.store.listBookmarks(userId)).map((b) => b.articleId);
    if (!current.includes(articleId)) current.push(articleId);
    return this.store.putBookmarks(current, userId);
  }

  @Delete(':articleId')
  async remove(@Param('articleId') articleId: string, @Query('userId') userId?: string) {
    const uid = parseUserId(userId);
    const current = (await this.store.listBookmarks(uid))
      .map((b) => b.articleId)
      .filter((id) => id !== articleId);
    return this.store.putBookmarks(current, uid);
  }
}
