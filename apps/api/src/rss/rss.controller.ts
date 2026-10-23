import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RssService } from './rss.service';

@Controller('rss')
export class RssController {
  constructor(private readonly rss: RssService) {}

  @Get('feeds')
  list() {
    return this.rss.list();
  }

  @Post('feeds')
  add(@Body() body: { url: string; category?: string }) {
    return this.rss.add(body.url, body.category ?? 'world');
  }

  @Delete('feeds/:id')
  remove(@Param('id') id: string) {
    return this.rss.remove(id);
  }

  @Patch('feeds/:id')
  toggle(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.rss.toggle(id, body.isActive);
  }

  @Post('parse')
  parse(@Body() body: { url: string }) {
    return this.rss.parse(body.url);
  }
}
