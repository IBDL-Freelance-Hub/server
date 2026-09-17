import { MembershipTier } from '@prisma/client';
import {
  getTierPrice,
  isValidUpgrade,
  MEMBERSHIP_TIER_PRICING,
  MEMBERSHIP_TIER_HIERARCHY,
} from '../../../../src/modules/membership/domain/pricing';

describe('Pricing & Tier Hierarchy Domain Logic (Spec v5.0, SEC-33, MEM-07)', () => {
  describe('Authoritative Server Pricing', () => {
    it('should have exact prices matching Spec v5.0', () => {
      expect(MEMBERSHIP_TIER_PRICING[MembershipTier.ESSENTIAL]).toBe(0.0);
      expect(MEMBERSHIP_TIER_PRICING[MembershipTier.PROFESSIONAL]).toBe(180.0);
      expect(MEMBERSHIP_TIER_PRICING[MembershipTier.MASTER]).toBe(380.0);
    });

    it('should return correct price via getTierPrice helper', () => {
      expect(getTierPrice(MembershipTier.ESSENTIAL)).toBe(0.0);
      expect(getTierPrice(MembershipTier.PROFESSIONAL)).toBe(180.0);
      expect(getTierPrice(MembershipTier.MASTER)).toBe(380.0);
    });
  });

  describe('Upgrade Hierarchy Validation', () => {
    it('should establish strict tier hierarchy: ESSENTIAL < PROFESSIONAL < MASTER', () => {
      expect(MEMBERSHIP_TIER_HIERARCHY[MembershipTier.ESSENTIAL]).toBeLessThan(
        MEMBERSHIP_TIER_HIERARCHY[MembershipTier.PROFESSIONAL],
      );
      expect(MEMBERSHIP_TIER_HIERARCHY[MembershipTier.PROFESSIONAL]).toBeLessThan(
        MEMBERSHIP_TIER_HIERARCHY[MembershipTier.MASTER],
      );
    });

    it('should return true for valid upgrades moving strictly upward', () => {
      expect(isValidUpgrade(MembershipTier.ESSENTIAL, MembershipTier.PROFESSIONAL)).toBe(true);
      expect(isValidUpgrade(MembershipTier.ESSENTIAL, MembershipTier.MASTER)).toBe(true);
      expect(isValidUpgrade(MembershipTier.PROFESSIONAL, MembershipTier.MASTER)).toBe(true);
    });

    it('should return false for same tier attempts', () => {
      expect(isValidUpgrade(MembershipTier.ESSENTIAL, MembershipTier.ESSENTIAL)).toBe(false);
      expect(isValidUpgrade(MembershipTier.PROFESSIONAL, MembershipTier.PROFESSIONAL)).toBe(false);
      expect(isValidUpgrade(MembershipTier.MASTER, MembershipTier.MASTER)).toBe(false);
    });

    it('should return false for downgrade attempts', () => {
      expect(isValidUpgrade(MembershipTier.MASTER, MembershipTier.PROFESSIONAL)).toBe(false);
      expect(isValidUpgrade(MembershipTier.MASTER, MembershipTier.ESSENTIAL)).toBe(false);
      expect(isValidUpgrade(MembershipTier.PROFESSIONAL, MembershipTier.ESSENTIAL)).toBe(false);
    });
  });
});
