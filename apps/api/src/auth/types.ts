export type SubscriptionTier = 'FREE' | 'PRO' | 'TEAM';

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  tier: SubscriptionTier;
  role: 'reader' | 'journalist' | 'admin';
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionEndsAt: Date | null;
  apiKey: string | null;
  teamId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamRecord {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export const TIER_RANK: Record<SubscriptionTier, number> = {
  FREE: 1,
  PRO: 2,
  TEAM: 3,
};

export function hasRequiredTier(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}
