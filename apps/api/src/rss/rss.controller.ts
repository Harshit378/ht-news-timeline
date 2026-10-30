import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Optional,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { RssService } from './rss.service';
import { AuthService } from '../auth/auth.service';

@Controller('rss')
export class RssController {
  constructor(
    private readonly rss: RssService,
    @Optional() private readonly authService?: AuthService,
  ) {}

  @Get('feeds')
  list() {
    return this.rss.list();
  }

  @Post('feeds')
  async add(
    @Body() body: { url: string; category?: string },
    @Headers() headers: Record<string, string | string[] | undefined> = {},
  ) {
    if (this.authService) {
      const token =
        (typeof headers.authorization === 'string' ? headers.authorization : undefined) ||
        (typeof headers['x-api-key'] === 'string' ? headers['x-api-key'] : undefined) ||
        (typeof headers['x-user-id'] === 'string' ? headers['x-user-id'] : undefined);

      const user = await this.authService.validateTokenOrHeader(token);
      const tier = user?.tier ?? 'FREE';

      const currentFeeds = await this.rss.list();
      const userFeeds = currentFeeds.filter((f) => f.origin === 'user');
      const maxFeeds = tier === 'TEAM' ? Infinity : tier === 'PRO' ? 25 : 3;

      if (userFeeds.length >= maxFeeds) {
        throw new ForbiddenException(
          `Custom feed limit reached for ${tier} tier (${maxFeeds} feeds maximum). Upgrade to add more custom feeds.`,
        );
      }
    }

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
