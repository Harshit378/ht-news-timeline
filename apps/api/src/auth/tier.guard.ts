import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { hasRequiredTier, SubscriptionTier } from './types';

export const TIER_KEY = 'required_tier';
export const RequiresTier = (tier: SubscriptionTier) => SetMetadata(TIER_KEY, tier);

@Injectable()
export class TierGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredTier = this.reflector.getAllAndOverride<SubscriptionTier | undefined>(
      TIER_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No tier restriction on route
    if (!requiredTier || requiredTier === 'FREE') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader =
      request.headers.authorization ||
      request.headers['x-api-key'] ||
      request.headers['x-user-id'];

    const user = await this.authService.validateTokenOrHeader(authHeader);

    if (!user) {
      throw new ForbiddenException({
        error: 'Authentication Required',
        message: `This feature requires a ${requiredTier} subscription tier. Please sign in or upgrade.`,
        requiredTier,
      });
    }

    if (!hasRequiredTier(user.tier, requiredTier)) {
      throw new ForbiddenException({
        error: 'Upgrade Required',
        message: `Your current tier is ${user.tier}. This feature requires ${requiredTier}.`,
        currentTier: user.tier,
        requiredTier,
      });
    }

    request.user = user;
    return true;
  }
}
