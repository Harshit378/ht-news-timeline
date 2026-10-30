import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { BillingService, StripeEventPayload } from './billing.service';
import { AuthService } from '../auth/auth.service';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly authService: AuthService,
  ) {}

  @Post('checkout-session')
  async createCheckoutSession(
    @Headers() headers: Record<string, string | undefined>,
    @Body()
    body: {
      tier?: 'PRO' | 'TEAM';
      successUrl?: string;
      cancelUrl?: string;
    },
  ) {
    const token =
      headers.authorization ||
      headers['x-api-key'] ||
      headers['x-user-id'];

    const user = await this.authService.validateTokenOrHeader(token);
    if (!user) {
      throw new UnauthorizedException('Authentication required to start a subscription');
    }

    const tier = body?.tier?.toUpperCase() === 'TEAM' ? 'TEAM' : 'PRO';
    return this.billingService.createCheckoutSession({
      userId: user.id,
      tier,
      successUrl: body?.successUrl,
      cancelUrl: body?.cancelUrl,
    });
  }

  @Post('portal-session')
  async createPortalSession(
    @Headers() headers: Record<string, string | undefined>,
    @Body() body: { returnUrl?: string },
  ) {
    const token =
      headers.authorization ||
      headers['x-api-key'] ||
      headers['x-user-id'];

    const user = await this.authService.validateTokenOrHeader(token);
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.billingService.createPortalSession(user.id, body?.returnUrl);
  }

  @Post('webhook')
  async handleWebhook(
    @Body() body: StripeEventPayload,
  ) {
    if (!body || typeof body.type !== 'string' || !body.data?.object) {
      throw new BadRequestException('Malformed webhook payload');
    }
    return this.billingService.handleWebhook(body);
  }
}
