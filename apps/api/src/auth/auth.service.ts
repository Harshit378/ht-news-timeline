import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionTier, UserRecord, TeamRecord } from './types';
import { randomUUID } from 'node:crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private memoryUsers = new Map<string, UserRecord>();
  private memoryTeams = new Map<string, TeamRecord>();

  constructor(private readonly prisma: PrismaService) {}

  private generateApiKey(): string {
    return `ht_${randomUUID().replace(/-/g, '')}`;
  }

  async register(params: {
    email: string;
    name?: string;
    tier?: SubscriptionTier;
    role?: 'reader' | 'journalist' | 'admin';
  }): Promise<{ user: UserRecord; apiKey: string }> {
    const email = params.email.trim().toLowerCase();
    const existing = await this.findByEmail(email);
    if (existing) {
      return { user: existing, apiKey: existing.apiKey || this.generateApiKey() };
    }

    const apiKey = this.generateApiKey();
    const tier = params.tier ?? 'FREE';
    const role = params.role ?? 'reader';
    const name = params.name?.trim() || null;

    if (await this.prisma.isReady()) {
      try {
        const created = await this.prisma.user.create({
          data: {
            email,
            name,
            tier,
            role,
            apiKey,
          },
        });
        const record = this.mapPrismaUser(created);
        return { user: record, apiKey };
      } catch (err) {
        this.logger.warn(`Prisma create failed, falling back to memory: ${err}`);
      }
    }

    const id = `usr_${randomUUID().slice(0, 12)}`;
    const now = new Date();
    const record: UserRecord = {
      id,
      email,
      name,
      tier,
      role,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: 'active',
      subscriptionEndsAt: null,
      apiKey,
      teamId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.memoryUsers.set(id, record);
    return { user: record, apiKey };
  }

  async login(emailRaw: string): Promise<{ user: UserRecord; apiKey: string }> {
    const email = emailRaw.trim().toLowerCase();
    const existing = await this.findByEmail(email);
    if (existing) {
      return { user: existing, apiKey: existing.apiKey ?? this.generateApiKey() };
    }
    return this.register({ email });
  }

  async findById(id: string): Promise<UserRecord | null> {
    if (await this.prisma.isReady()) {
      try {
        const u = await this.prisma.user.findUnique({ where: { id } });
        if (u) return this.mapPrismaUser(u);
      } catch (err) {
        this.logger.warn(`Prisma findUnique failed: ${err}`);
      }
    }
    return this.memoryUsers.get(id) ?? null;
  }

  async findByEmail(emailRaw: string): Promise<UserRecord | null> {
    const email = emailRaw.trim().toLowerCase();
    if (await this.prisma.isReady()) {
      try {
        const u = await this.prisma.user.findUnique({ where: { email } });
        if (u) return this.mapPrismaUser(u);
      } catch (err) {
        this.logger.warn(`Prisma findUnique by email failed: ${err}`);
      }
    }
    for (const u of this.memoryUsers.values()) {
      if (u.email === email) return u;
    }
    return null;
  }

  async findByApiKey(apiKey: string): Promise<UserRecord | null> {
    if (!apiKey) return null;
    if (await this.prisma.isReady()) {
      try {
        const u = await this.prisma.user.findUnique({ where: { apiKey } });
        if (u) return this.mapPrismaUser(u);
      } catch (err) {
        this.logger.warn(`Prisma findUnique by apiKey failed: ${err}`);
      }
    }
    for (const u of this.memoryUsers.values()) {
      if (u.apiKey === apiKey) return u;
    }
    return null;
  }

  async validateTokenOrHeader(tokenOrHeader?: string): Promise<UserRecord | null> {
    if (!tokenOrHeader) return null;
    const clean = tokenOrHeader.replace(/^Bearer\s+/i, '').trim();
    if (!clean) return null;

    // Check if it's an API key
    if (clean.startsWith('ht_')) {
      return this.findByApiKey(clean);
    }
    // Check if it's user id
    const byId = await this.findById(clean);
    if (byId) return byId;

    // Check if it's user email
    if (clean.includes('@')) {
      return this.findByEmail(clean);
    }

    return null;
  }

  async updateSubscription(
    userId: string,
    tier: SubscriptionTier,
    stripeInfo: {
      customerId?: string;
      subscriptionId?: string;
      status?: string;
      endsAt?: Date | null;
    } = {},
  ): Promise<UserRecord | null> {
    if (await this.prisma.isReady()) {
      try {
        const updated = await this.prisma.user.update({
          where: { id: userId },
          data: {
            tier,
            stripeCustomerId: stripeInfo.customerId,
            stripeSubscriptionId: stripeInfo.subscriptionId,
            subscriptionStatus: stripeInfo.status ?? 'active',
            subscriptionEndsAt: stripeInfo.endsAt,
          },
        });
        return this.mapPrismaUser(updated);
      } catch (err) {
        this.logger.warn(`Prisma user update failed: ${err}`);
      }
    }

    const mem = this.memoryUsers.get(userId);
    if (!mem) return null;
    const updated: UserRecord = {
      ...mem,
      tier,
      stripeCustomerId: stripeInfo.customerId ?? mem.stripeCustomerId,
      stripeSubscriptionId: stripeInfo.subscriptionId ?? mem.stripeSubscriptionId,
      subscriptionStatus: stripeInfo.status ?? 'active',
      subscriptionEndsAt: stripeInfo.endsAt ?? mem.subscriptionEndsAt,
      updatedAt: new Date(),
    };
    this.memoryUsers.set(userId, updated);
    return updated;
  }

  async createTeam(name: string, ownerId: string): Promise<TeamRecord> {
    const now = new Date();
    const teamId = `team_${randomUUID().slice(0, 12)}`;

    if (await this.prisma.isReady()) {
      try {
        const created = await this.prisma.team.create({
          data: {
            name,
            ownerId,
          },
        });
        await this.prisma.user.update({
          where: { id: ownerId },
          data: { teamId: created.id, tier: 'TEAM' },
        });
        return {
          id: created.id,
          name: created.name,
          ownerId: created.ownerId,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        };
      } catch (err) {
        this.logger.warn(`Prisma team create failed: ${err}`);
      }
    }

    const team: TeamRecord = {
      id: teamId,
      name,
      ownerId,
      createdAt: now,
      updatedAt: now,
    };
    this.memoryTeams.set(teamId, team);
    const user = this.memoryUsers.get(ownerId);
    if (user) {
      this.memoryUsers.set(ownerId, { ...user, teamId, tier: 'TEAM' });
    }
    return team;
  }

  private mapPrismaUser(u: {
    id: string;
    email: string;
    name: string | null;
    tier: string;
    role: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    subscriptionStatus: string | null;
    subscriptionEndsAt: Date | null;
    apiKey: string | null;
    teamId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserRecord {
    return {
      ...u,
      tier: (['FREE', 'PRO', 'TEAM'].includes(u.tier) ? u.tier : 'FREE') as SubscriptionTier,
      role: (['reader', 'journalist', 'admin'].includes(u.role) ? u.role : 'reader') as 'reader' | 'journalist' | 'admin',
    };
  }
}
