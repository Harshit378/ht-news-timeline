import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { NewsStore } from '../store/news.store';

@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly store: NewsStore) {}

  @Get()
  async findAll(@Query('userId') userId?: string) {
    return { items: await this.store.listBookmarks(userId ?? 'local') };
  }

  @Put()
  put(@Body() body: { articleIds: string[]; userId?: string }) {
    return this.store.putBookmarks(body.articleIds ?? [], body.userId ?? 'local');
  }

  @Post()
  async create(@Body() body: { articleId: string; userId?: string }) {
    const userId = body.userId ?? 'local';
    const current = (await this.store.listBookmarks(userId)).map((b) => b.articleId);
    if (!current.includes(body.articleId)) current.push(body.articleId);
    return this.store.putBookmarks(current, userId);
  }

  @Delete(':articleId')
  async remove(@Param('articleId') articleId: string, @Query('userId') userId?: string) {
    const uid = userId ?? 'local';
    const current = (await this.store.listBookmarks(uid))
      .map((b) => b.articleId)
      .filter((id) => id !== articleId);
    return this.store.putBookmarks(current, uid);
  }
}
