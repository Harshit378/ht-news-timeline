import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { SubscriptionTier } from '../auth/types';
import { randomUUID } from 'node:crypto';

export interface StripeEventPayload {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

async function loadStripeClient(): Promise<any> {
  try {
    const pkg = 'stripe';
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const mod = await import(/* webpackIgnore: true */ pkg);
    return mod?.default || mod;
  } catch {
    return null;
  }
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripeKey = process.env.STRIPE_SECRET_KEY;
  private readonly webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  constructor(private readonly authService: AuthService) {}

  get isConfigured(): boolean {
    return Boolean(this.stripeKey);
  }

  async createCheckoutSession(params: {
    userId: string;
    tier: 'PRO' | 'TEAM';
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<{ sessionId: string; url: string; mode: 'live' | 'test' }> {
    const user = await this.authService.findById(params.userId);
    const successUrl = params.successUrl || 'http://localhost:4200/settings/?checkout=success';
    const cancelUrl = params.cancelUrl || 'http://localhost:4200/settings/?checkout=cancelled';

    if (!this.stripeKey) {
      this.logger.log(`STRIPE_SECRET_KEY unset: issuing test checkout session for ${params.userId} -> ${params.tier}`);
      const sessionId = `cs_test_${randomUUID().replace(/-/g, '')}`;
      return {
        sessionId,
        url: `${successUrl}&session_id=${sessionId}&tier=${params.tier}`,
        mode: 'test',
      };
    }

    // When real STRIPE_SECRET_KEY is configured
    try {
      const Stripe = await loadStripeClient();
      if (!Stripe) {
        throw new Error('Stripe package is not installed. Run `pnpm add stripe` to enable live billing.');
      }
      const stripe = new Stripe(this.stripeKey, { apiVersion: '2025-02-24.acacia' as never });

      const priceId =
        params.tier === 'TEAM'
          ? process.env.STRIPE_TEAM_PRICE_ID
          : process.env.STRIPE_PRO_PRICE_ID;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        client_reference_id: params.userId,
        customer_email: user?.email,
        metadata: {
          userId: params.userId,
          tier: params.tier,
        },
        line_items: priceId
          ? [{ price: priceId, quantity: 1 }]
          : [
              {
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: `News Timeline ${params.tier} Subscription`,
                    description:
                      params.tier === 'TEAM'
                        ? 'Real-time WebSocket alerts, team seats & unlimited feeds'
                        : 'Ad-free, cloud bookmark sync, AI topic summaries & source comparison',
                  },
                  unit_amount: params.tier === 'TEAM' ? 2900 : 900,
                  recurring: { interval: 'month' },
                },
                quantity: 1,
              },
            ],
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      return {
        sessionId: session.id,
        url: session.url || successUrl,
        mode: 'live',
      };
    } catch (err) {
      this.logger.error(`Stripe checkout creation failed: ${err}`);
      throw err;
    }
  }

  async createPortalSession(userId: string, returnUrl?: string): Promise<{ url: string }> {
    const user = await this.authService.findById(userId);
    const ret = returnUrl || 'http://localhost:4200/settings/';

    if (!this.stripeKey || !user?.stripeCustomerId) {
      return { url: `${ret}?portal=simulated` };
    }

    try {
      const Stripe = await loadStripeClient();
      if (!Stripe) {
        return { url: `${ret}?portal=sdk_missing` };
      }
      const stripe = new Stripe(this.stripeKey, { apiVersion: '2025-02-24.acacia' as never });
      const portal = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: ret,
      });
      return { url: portal.url };
    } catch (err) {
      this.logger.error(`Stripe portal creation failed: ${err}`);
      return { url: ret };
    }
  }

  /**
   * Processes Stripe webhook events (checkout completed, subscription updated/deleted, invoice payment).
   */
  async handleWebhook(event: StripeEventPayload): Promise<{ processed: boolean; type: string }> {
    this.logger.log(`Handling Stripe webhook event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as {
          client_reference_id?: string;
          customer?: string;
          subscription?: string;
          metadata?: { userId?: string; tier?: string };
        };
        const userId = session.metadata?.userId || session.client_reference_id;
        const tier = (session.metadata?.tier?.toUpperCase() || 'PRO') as SubscriptionTier;
        if (userId) {
          await this.authService.updateSubscription(userId, tier, {
            customerId: session.customer,
            subscriptionId: session.subscription,
            status: 'active',
          });
          this.logger.log(`User ${userId} upgraded to ${tier} via checkout session`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as {
          id: string;
          customer: string;
          status: string;
          current_period_end?: number;
          metadata?: { userId?: string; tier?: string };
        };
        const userId = sub.metadata?.userId;
        const tier = (sub.metadata?.tier?.toUpperCase() || 'PRO') as SubscriptionTier;
        const endsAt = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
        if (userId) {
          await this.authService.updateSubscription(userId, tier, {
            customerId: sub.customer,
            subscriptionId: sub.id,
            status: sub.status,
            endsAt,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as {
          id: string;
          customer: string;
          metadata?: { userId?: string };
        };
        const userId = sub.metadata?.userId;
        if (userId) {
          await this.authService.updateSubscription(userId, 'FREE', {
            customerId: sub.customer,
            subscriptionId: sub.id,
            status: 'canceled',
            endsAt: new Date(),
          });
          this.logger.log(`User ${userId} subscription cancelled, downgraded to FREE`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as {
          customer?: string;
          subscription?: string;
        };
        this.logger.log(`Payment succeeded for customer ${invoice.customer}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as {
          customer?: string;
          subscription?: string;
        };
        this.logger.warn(`Payment failed for customer ${invoice.customer}`);
        break;
      }

      default:
        this.logger.debug(`Unhandled event type: ${event.type}`);
    }

    return { processed: true, type: event.type };
  }
}
