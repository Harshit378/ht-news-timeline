import { describe, expect, it } from 'vitest';
import { BillingService } from './billing.service';
import { AuthService } from '../auth/auth.service';

describe('Billing & Stripe Webhooks (ADR-007)', () => {
  const fakePrisma = { isReady: async () => false } as never;
  const authService = new AuthService(fakePrisma);
  const billingService = new BillingService(authService);

  it('creates test checkout session when STRIPE_SECRET_KEY is omitted', async () => {
    const { user } = await authService.register({ email: 'checkout_user@example.com' });
    const session = await billingService.createCheckoutSession({
      userId: user.id,
      tier: 'PRO',
    });

    expect(session.mode).toBe('test');
    expect(session.sessionId).toMatch(/^cs_test_/);
    expect(session.url).toContain('checkout=success');
  });

  it('processes checkout.session.completed webhook to upgrade user tier', async () => {
    const { user } = await authService.register({ email: 'webhook_test@example.com' });
    expect(user.tier).toBe('FREE');

    await billingService.handleWebhook({
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: user.id,
          customer: 'cus_stripe_111',
          subscription: 'sub_stripe_222',
          metadata: { userId: user.id, tier: 'PRO' },
        },
      },
    });

    const upgraded = await authService.findById(user.id);
    expect(upgraded?.tier).toBe('PRO');
    expect(upgraded?.stripeCustomerId).toBe('cus_stripe_111');
    expect(upgraded?.stripeSubscriptionId).toBe('sub_stripe_222');
  });

  it('processes customer.subscription.deleted to downgrade user to FREE', async () => {
    const { user } = await authService.register({ email: 'canceller@example.com', tier: 'PRO' });
    await authService.updateSubscription(user.id, 'PRO', { customerId: 'cus_canceller' });

    await billingService.handleWebhook({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          customer: 'cus_canceller',
          metadata: { userId: user.id },
        },
      },
    });

    const downgraded = await authService.findById(user.id);
    expect(downgraded?.tier).toBe('FREE');
    expect(downgraded?.subscriptionStatus).toBe('canceled');
  });
});
