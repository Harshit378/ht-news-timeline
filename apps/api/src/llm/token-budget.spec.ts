import { describe, expect, it } from 'vitest';
import { TokenBudget } from './token-budget';

describe('TokenBudget (ADR-004 + ADR-007)', () => {
  it('tracks global token usage and rolls at UTC day boundary', () => {
    let now = new Date('2026-10-31T10:00:00Z');
    const budget = new TokenBudget(100_000, () => now);

    budget.add(10_000);
    expect(budget.usedToday).toBe(10_000);
    expect(budget.exhausted).toBe(false);

    budget.add(95_000);
    expect(budget.usedToday).toBe(105_000);
    expect(budget.exhausted).toBe(true);

    // Roll to next day
    now = new Date('2026-11-01T00:00:01Z');
    expect(budget.usedToday).toBe(0);
    expect(budget.exhausted).toBe(false);
  });

  it('enforces tier-based per-user token quotas', () => {
    let now = new Date('2026-10-31T10:00:00Z');
    const budget = new TokenBudget(10_000_000, () => now);

    const userFree = 'user_free_1';
    const userPro = 'user_pro_1';

    // FREE limit is 50,000
    budget.add(40_000, userFree);
    expect(budget.getUserUsedToday(userFree)).toBe(40_000);
    expect(budget.isExhaustedForUser(userFree, 'FREE')).toBe(false);

    budget.add(15_000, userFree);
    expect(budget.getUserUsedToday(userFree)).toBe(55_000);
    expect(budget.isExhaustedForUser(userFree, 'FREE')).toBe(true);

    // PRO user with same 55k is not exhausted (limit 500,000)
    budget.add(55_000, userPro);
    expect(budget.isExhaustedForUser(userPro, 'PRO')).toBe(false);

    // Day rollover resets user quotas too
    now = new Date('2026-11-01T00:00:01Z');
    expect(budget.getUserUsedToday(userFree)).toBe(0);
    expect(budget.isExhaustedForUser(userFree, 'FREE')).toBe(false);
  });
});
