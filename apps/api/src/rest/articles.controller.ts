import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { NewsStore } from '../store/news.store';
import { serializeArticle } from './serialize';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly store: NewsStore) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    const article = this.store.getArticle(id);
    if (!article) throw new NotFoundException();
    return serializeArticle(article);
  }
}
