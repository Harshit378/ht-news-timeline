/**
 * Global daily token ceiling and per-user tier quotas for paid LLM providers (ADR-004 + ADR-007).
 */
export type UserTier = 'ANONYMOUS' | 'FREE' | 'PRO' | 'TEAM';

export const TIER_DAILY_TOKEN_LIMITS: Record<UserTier, number> = {
  ANONYMOUS: 20_000,
  FREE: 50_000,
  PRO: 500_000,
  TEAM: 2_000_000,
};

export class TokenBudget {
  private day = '';
  private used = 0;
  private userUsage = new Map<string, number>();

  constructor(
    readonly limit: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Global tokens used so far in the current UTC day. */
  get usedToday() {
    this.roll();
    return this.used;
  }

  get exhausted() {
    return this.limit > 0 && this.usedToday >= this.limit;
  }

  add(tokens: number, userId?: string) {
    this.roll();
    const count = Math.max(0, tokens);
    this.used += count;
    if (userId) {
      const current = this.userUsage.get(userId) ?? 0;
      this.userUsage.set(userId, current + count);
    }
  }

  getUserUsedToday(userId: string): number {
    this.roll();
    return this.userUsage.get(userId) ?? 0;
  }

  getUserLimit(tier: UserTier = 'ANONYMOUS'): number {
    return TIER_DAILY_TOKEN_LIMITS[tier] ?? TIER_DAILY_TOKEN_LIMITS.ANONYMOUS;
  }

  isExhaustedForUser(userId?: string, tier: UserTier = 'ANONYMOUS'): boolean {
    if (this.exhausted) return true;
    if (!userId) return false;
    const userLimit = this.getUserLimit(tier);
    return userLimit > 0 && this.getUserUsedToday(userId) >= userLimit;
  }

  private roll() {
    const today = this.now().toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.used = 0;
      this.userUsage.clear();
    }
  }
}
