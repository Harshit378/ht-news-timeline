import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private ready = false;

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL missing — API will use in-memory store');
      return;
    }
    try {
      await this.$connect();
      this.ready = true;
      this.logger.log('Connected to PostgreSQL');
    } catch (err) {
      this.logger.warn(
        `PostgreSQL unavailable (${err instanceof Error ? err.message : err}) — using in-memory store`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.ready) await this.$disconnect();
  }

  async isReady() {
    return this.ready;
  }
}
