import { CatalogItemCategory, PricingModel } from '@prisma/client';
import {
  getContractualQuarter,
  addContractualMonths,
  isQuarterlyEntitlementAvailable,
  isEligibleForMasterQuarterlyEntitlement,
} from '../../../../src/modules/requests/domain/quarterly-entitlement';

describe('QuarterlyEntitlement Pure Domain Unit Tests (MEM-14, MEM-16, MEM-76)', () => {
  const membershipStartDate = new Date('2026-01-15T00:00:00.000Z');

  describe('Contractual Quarter Partitioning', () => {
    it('should correctly partition Q1 [Jan 15 -> Apr 15)', () => {
      const q1Date = new Date('2026-02-20T12:00:00.000Z');
      const info = getContractualQuarter(membershipStartDate, q1Date);

      expect(info.membershipYear).toBe(1);
      expect(info.quarterIndex).toBe(1);
      expect(info.quarterStart.toISOString()).toBe('2026-01-15T00:00:00.000Z');
      expect(info.quarterEnd.toISOString()).toBe('2026-04-15T00:00:00.000Z');
    });

    it('should correctly partition Q2 [Apr 15 -> Jul 15)', () => {
      const q2Date = new Date('2026-04-15T00:00:00.000Z');
      const info = getContractualQuarter(membershipStartDate, q2Date);

      expect(info.membershipYear).toBe(1);
      expect(info.quarterIndex).toBe(2);
      expect(info.quarterStart.toISOString()).toBe('2026-04-15T00:00:00.000Z');
      expect(info.quarterEnd.toISOString()).toBe('2026-07-15T00:00:00.000Z');
    });

    it('should correctly partition Q3 [Jul 15 -> Oct 15)', () => {
      const q3Date = new Date('2026-08-01T00:00:00.000Z');
      const info = getContractualQuarter(membershipStartDate, q3Date);

      expect(info.membershipYear).toBe(1);
      expect(info.quarterIndex).toBe(3);
      expect(info.quarterStart.toISOString()).toBe('2026-07-15T00:00:00.000Z');
      expect(info.quarterEnd.toISOString()).toBe('2026-10-15T00:00:00.000Z');
    });

    it('should correctly partition Q4 [Oct 15 -> Jan 15 of next year)', () => {
      const q4Date = new Date('2026-11-20T00:00:00.000Z');
      const info = getContractualQuarter(membershipStartDate, q4Date);

      expect(info.membershipYear).toBe(1);
      expect(info.quarterIndex).toBe(4);
      expect(info.quarterStart.toISOString()).toBe('2026-10-15T00:00:00.000Z');
      expect(info.quarterEnd.toISOString()).toBe('2027-01-15T00:00:00.000Z');
    });

    it('should correctly advance to membershipYear 2 after 1 year elapsed', () => {
      const year2Date = new Date('2027-02-01T00:00:00.000Z');
      const info = getContractualQuarter(membershipStartDate, year2Date);

      expect(info.membershipYear).toBe(2);
      expect(info.quarterIndex).toBe(1);
      expect(info.quarterStart.toISOString()).toBe('2027-01-15T00:00:00.000Z');
    });
  });

  describe('Month Boundary and Safe Clamping', () => {
    it('should safely clamp date when adding months to Jan 31 in a non-leap year', () => {
      const jan31 = new Date(Date.UTC(2025, 0, 31)); // Jan 31, 2025
      const febResult = addContractualMonths(jan31, 1);
      expect(febResult.getUTCFullYear()).toBe(2025);
      expect(febResult.getUTCMonth()).toBe(1); // Feb
      expect(febResult.getUTCDate()).toBe(28); // Clamped to Feb 28
    });

    it('should safely clamp date when adding months to Jan 31 in a leap year', () => {
      const jan31 = new Date(Date.UTC(2024, 0, 31)); // Jan 31, 2024 (leap year)
      const febResult = addContractualMonths(jan31, 1);
      expect(febResult.getUTCFullYear()).toBe(2024);
      expect(febResult.getUTCMonth()).toBe(1); // Feb
      expect(febResult.getUTCDate()).toBe(29); // Clamped to Feb 29
    });
  });

  describe('Non-Rollover & Quota Availability (MEM-76)', () => {
    it('should indicate available if 0 entitlements used in current quarter', () => {
      expect(isQuarterlyEntitlementAvailable(0)).toBe(true);
    });

    it('should indicate unavailable if 1 or more entitlements already used in current quarter', () => {
      expect(isQuarterlyEntitlementAvailable(1)).toBe(false);
      expect(isQuarterlyEntitlementAvailable(2)).toBe(false);
    });
  });

  describe('Derived Master Quarterly Eligibility Rule (BRU-47, MEM-14, MEM-16, MEM-76)', () => {
    it('should return true for active diagnostic tools with priced model', () => {
      expect(
        isEligibleForMasterQuarterlyEntitlement({
          category: CatalogItemCategory.DIAGNOSTIC_TOOL,
          pricingModel: PricingModel.FREE_THEN_PAID,
          isActive: true,
        }),
      ).toBe(true);

      expect(
        isEligibleForMasterQuarterlyEntitlement({
          category: CatalogItemCategory.DIAGNOSTIC_TOOL,
          pricingModel: PricingModel.FIXED,
          isActive: true,
        }),
      ).toBe(true);
    });

    it('should return true for active business simulation games with priced model', () => {
      expect(
        isEligibleForMasterQuarterlyEntitlement({
          category: CatalogItemCategory.BUSINESS_SIMULATION,
          pricingModel: PricingModel.FIXED,
          isActive: true,
        }),
      ).toBe(true);

      expect(
        isEligibleForMasterQuarterlyEntitlement({
          category: CatalogItemCategory.BUSINESS_SIMULATION,
          pricingModel: PricingModel.QUOTED,
          isActive: true,
        }),
      ).toBe(true);
    });

    it('should return false if item is inactive regardless of category and pricingModel', () => {
      expect(
        isEligibleForMasterQuarterlyEntitlement({
          category: CatalogItemCategory.DIAGNOSTIC_TOOL,
          pricingModel: PricingModel.FREE_THEN_PAID,
          isActive: false,
        }),
      ).toBe(false);

      expect(
        isEligibleForMasterQuarterlyEntitlement({
          category: CatalogItemCategory.BUSINESS_SIMULATION,
          pricingModel: PricingModel.FIXED,
          isActive: false,
        }),
      ).toBe(false);
    });

    it('should return false if pricingModel is NONE or IN_HUB', () => {
      // Info-only simulation games (Micromatic, Mogul CEO, Maven)
      expect(
        isEligibleForMasterQuarterlyEntitlement({
          category: CatalogItemCategory.BUSINESS_SIMULATION,
          pricingModel: PricingModel.NONE,
          isActive: true,
        }),
      ).toBe(false);

      // In-hub non-requestable items
      expect(
        isEligibleForMasterQuarterlyEntitlement({
          category: CatalogItemCategory.BUSINESS_SIMULATION,
          pricingModel: PricingModel.IN_HUB,
          isActive: true,
        }),
      ).toBe(false);
    });

    it('should return false for other categories (CORE_SERVICE, PROFESSIONAL_RECOGNITION)', () => {
      expect(
        isEligibleForMasterQuarterlyEntitlement({
          category: CatalogItemCategory.CORE_SERVICE,
          pricingModel: PricingModel.PERCENTAGE,
          isActive: true,
        }),
      ).toBe(false);

      expect(
        isEligibleForMasterQuarterlyEntitlement({
          category: CatalogItemCategory.CORE_SERVICE,
          pricingModel: PricingModel.IN_HUB,
          isActive: true,
        }),
      ).toBe(false);

      expect(
        isEligibleForMasterQuarterlyEntitlement({
          category: CatalogItemCategory.PROFESSIONAL_RECOGNITION,
          pricingModel: PricingModel.FIXED,
          isActive: true,
        }),
      ).toBe(false);
    });
  });
});
