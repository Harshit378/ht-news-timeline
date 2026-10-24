import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { NewsStore } from '../store/news.store';
import { serializeArticle } from './serialize';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly store: NewsStore) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const article = await this.store.getArticle(id);
    if (!article) throw new NotFoundException();
    return serializeArticle(article);
  }
}
