import { describe, expect, it } from 'vitest';
import { AuthService } from './auth.service';
import { TierGuard } from './tier.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';

describe('Auth & Tier Guards (ADR-007)', () => {
  const fakePrisma = { isReady: async () => false } as never;
  const authService = new AuthService(fakePrisma);

  it('registers and logs in a new user with default FREE tier', async () => {
    const res = await authService.register({ email: 'reader@example.com', name: 'Reader One' });
    expect(res.user.email).toBe('reader@example.com');
    expect(res.user.tier).toBe('FREE');
    expect(res.apiKey).toMatch(/^ht_/);

    const loginRes = await authService.login('reader@example.com');
    expect(loginRes.user.id).toBe(res.user.id);
  });

  it('validates user by API key or Bearer token', async () => {
    const { user, apiKey } = await authService.register({ email: 'keytest@example.com' });
    const validatedByKey = await authService.validateTokenOrHeader(apiKey);
    expect(validatedByKey?.id).toBe(user.id);

    const validatedByBearer = await authService.validateTokenOrHeader(`Bearer ${apiKey}`);
    expect(validatedByBearer?.id).toBe(user.id);

    const validatedById = await authService.validateTokenOrHeader(user.id);
    expect(validatedById?.id).toBe(user.id);
  });

  it('updates subscription tier and handles team creation', async () => {
    const { user } = await authService.register({ email: 'subscriber@example.com' });
    const updated = await authService.updateSubscription(user.id, 'PRO', {
      customerId: 'cus_123',
      subscriptionId: 'sub_456',
      status: 'active',
    });
    expect(updated?.tier).toBe('PRO');
    expect(updated?.stripeCustomerId).toBe('cus_123');

    // Create team upgrades owner to TEAM
    const team = await authService.createTeam('Newsroom Tech', user.id);
    expect(team.name).toBe('Newsroom Tech');
    expect(team.ownerId).toBe(user.id);

    const refreshed = await authService.findById(user.id);
    expect(refreshed?.tier).toBe('TEAM');
    expect(refreshed?.teamId).toBe(team.id);
  });

  it('enforces tier guard on protected routes', async () => {
    const reflector = new Reflector();
    const guard = new TierGuard(reflector, authService);

    // Register a FREE user
    const { apiKey: freeKey } = await authService.register({ email: 'free_guy@example.com' });

    // Mock execution context requiring PRO
    const makeContext = (header?: string) =>
      ({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            headers: header ? { authorization: `Bearer ${header}` } : {},
          }),
        }),
      }) as never;

    reflector.getAllAndOverride = () => 'PRO';

    // Anonymous request fails
    await expect(guard.canActivate(makeContext())).rejects.toThrow(ForbiddenException);

    // Free user fails PRO requirement
    await expect(guard.canActivate(makeContext(freeKey))).rejects.toThrow(ForbiddenException);

    // Upgrade user to PRO -> passes
    const freeUser = await authService.findByEmail('free_guy@example.com');
    await authService.updateSubscription(freeUser!.id, 'PRO');

    await expect(guard.canActivate(makeContext(freeKey))).resolves.toBe(true);
  });
});
