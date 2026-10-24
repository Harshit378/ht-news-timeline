import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export type MigrationState = 'ok' | 'pending' | 'n/a';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private ready = false;
  private migrations: MigrationState = 'n/a';

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL missing — API will use in-memory store');
      return;
    }
    try {
      await this.$connect();
    } catch (err) {
      this.logger.warn(
        `PostgreSQL unavailable (${err instanceof Error ? err.message : err}) — using in-memory store`,
      );
      return;
    }
    // A reachable but unmigrated database would fail on the first query; fall back instead.
    try {
      await this.$queryRaw`SELECT 1 FROM "Story" LIMIT 1`;
      this.migrations = 'ok';
      this.ready = true;
      this.logger.log('Connected to PostgreSQL');
    } catch {
      this.migrations = 'pending';
      this.logger.warn('PostgreSQL schema is not migrated — run `pnpm db:deploy`. Using in-memory store');
      await this.$disconnect();
    }
  }

  async onModuleDestroy() {
    if (this.ready) await this.$disconnect();
  }

  async isReady() {
    return this.ready;
  }

  migrationState() {
    return this.migrations;
  }
}
