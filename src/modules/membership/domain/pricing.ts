import { MembershipTier } from '@prisma/client';

export const MEMBERSHIP_TIER_PRICING: Record<MembershipTier, number> = {
  [MembershipTier.ESSENTIAL]: 0.0,
  [MembershipTier.PROFESSIONAL]: 180.0,
  [MembershipTier.MASTER]: 380.0,
};

export const MEMBERSHIP_TIER_HIERARCHY: Record<MembershipTier, number> = {
  [MembershipTier.ESSENTIAL]: 1,
  [MembershipTier.PROFESSIONAL]: 2,
  [MembershipTier.MASTER]: 3,
};

/**
 * Returns the authoritative server-configured annual price for a membership tier (SEC-33).
 */
export function getTierPrice(tier: MembershipTier): number {
  return MEMBERSHIP_TIER_PRICING[tier] ?? 0.0;
}

/**
 * Validates that the target tier is strictly higher in hierarchy than the current tier.
 * Upgrades must move up: ESSENTIAL -> PROFESSIONAL/MASTER, PROFESSIONAL -> MASTER.
 */
export function isValidUpgrade(currentTier: MembershipTier, targetTier: MembershipTier): boolean {
  const currentLevel = MEMBERSHIP_TIER_HIERARCHY[currentTier] ?? 0;
  const targetLevel = MEMBERSHIP_TIER_HIERARCHY[targetTier] ?? 0;
  return targetLevel > currentLevel;
}
