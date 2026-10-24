import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** UTC day ("2026-10-25") and month ("2026-10") period keys. */
export const dayPeriod = (d = new Date()) => d.toISOString().slice(0, 10);
export const monthPeriod = (d = new Date()) => d.toISOString().slice(0, 7);

/**
 * Metered upstream usage (ADR-008): News Search API requests per day, BigQuery bytes per month.
 * Kept in memory and mirrored to `ProviderUsage` so a restart doesn't reset a quota.
 * Without Postgres it is memory-only.
 */
@Injectable()
export class UsageTracker {
  private readonly logger = new Logger(UsageTracker.name);
  private readonly amounts = new Map<string, number>();
  private readonly loaded = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async get(provider: string, period: string): Promise<number> {
    const id = `${provider}:${period}`;
    if (!this.loaded.has(id)) {
      this.loaded.add(id);
      if (await this.prisma.isReady()) {
        try {
          const row = await this.prisma.providerUsage.findUnique({ where: { id } });
          this.amounts.set(id, Math.max(this.amounts.get(id) ?? 0, row?.amount ?? 0));
        } catch (err) {
          this.logger.warn(`usage read failed: ${err instanceof Error ? err.message : err}`);
        }
      }
    }
    return this.amounts.get(id) ?? 0;
  }

  async add(provider: string, period: string, amount: number): Promise<number> {
    const id = `${provider}:${period}`;
    const total = (await this.get(provider, period)) + amount;
    this.amounts.set(id, total);
    if (await this.prisma.isReady()) {
      try {
        await this.prisma.providerUsage.upsert({
          where: { id },
          create: { id, provider, period, amount },
          update: { amount: { increment: amount } },
        });
      } catch (err) {
        this.logger.warn(`usage write failed: ${err instanceof Error ? err.message : err}`);
      }
    }
    return total;
  }
}
