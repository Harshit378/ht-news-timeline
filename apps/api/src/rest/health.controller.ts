import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NewsStore } from '../store/news.store';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: NewsStore,
  ) {}

  @Get()
  async health() {
    const postgres = await this.prisma.isReady();
    return {
      ok: true,
      database: postgres ? 'postgres' : 'memory',
      /** 'pending' = database reachable but `pnpm db:deploy` has not been run. */
      migrations: this.prisma.migrationState(),
      ...(postgres && { counts: await this.store.stats() }),
    };
  }
}
