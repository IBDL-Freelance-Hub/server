import {
  MembershipTier,
  MembershipStatus,
  CatalogItemCategory,
  PricingModel,
} from '@prisma/client';
import {
  calculateItemPricing,
  calculateApprovedPrice,
} from '../../../../src/modules/requests/domain/pricing-calculator';
import { isEligibleForMasterQuarterlyEntitlement } from '../../../../src/modules/requests/domain/quarterly-entitlement';

describe('PricingCalculator Pure Domain Unit Tests (MEM-13, MEM-33a, MEM-33b, BRU-47, SEC-33)', () => {
  // Minor units convention: $250.00 = 25000 cents, $150.00 = 15000 cents
  const basePriceCents = 15000;

  describe('Active Membership Tier Discounts (MEM-13)', () => {
    it('should calculate 15% discount for active ESSENTIAL tier', () => {
      const result = calculateItemPricing({
        basePrice: basePriceCents,
        category: CatalogItemCategory.CORE_SERVICE,
        tier: MembershipTier.ESSENTIAL,
        membershipStatus: MembershipStatus.ACTIVE,
      });

      expect(result.basePrice).toBe(15000);
      expect(result.discountPercentage).toBe(15.0);
      expect(result.discountAmount).toBe(2250);
      expect(result.finalPrice).toBe(12750);
      expect(result.currency).toBe('USD');
      expect(result.isIncludedWithPlan).toBe(false);
      expect(result.isQuarterlyEntitlementApplied).toBe(false);
    });

    it('should calculate 30% discount for active PROFESSIONAL tier', () => {
      const result = calculateItemPricing({
        basePrice: basePriceCents,
        category: CatalogItemCategory.CORE_SERVICE,
        tier: MembershipTier.PROFESSIONAL,
        membershipStatus: MembershipStatus.ACTIVE,
      });

      expect(result.basePrice).toBe(15000);
      expect(result.discountPercentage).toBe(30.0);
      expect(result.discountAmount).toBe(4500);
      expect(result.finalPrice).toBe(10500);
      expect(result.isIncludedWithPlan).toBe(false);
    });

    it('should calculate 40% discount for active MASTER tier on paid diagnostic tools', () => {
      const result = calculateItemPricing({
        basePrice: 22000,
        category: CatalogItemCategory.DIAGNOSTIC_TOOL,
        tier: MembershipTier.MASTER,
        membershipStatus: MembershipStatus.ACTIVE,
        isQuarterlyEntitlementEligible: false,
      });

      expect(result.basePrice).toBe(22000);
      expect(result.discountPercentage).toBe(40.0);
      expect(result.discountAmount).toBe(8800);
      expect(result.finalPrice).toBe(13200);
      expect(result.isQuarterlyEntitlementApplied).toBe(false);
    });
  });

  describe('User Test Case 1: Trainer Accreditation $250 -> 212.50 / 175.00 / 150.00 (in minor units: 25000 -> 21250 / 17500 / 15000)', () => {
    const trainerAccreditationCents = 25000;

    it('should calculate 21250 cents ($212.50) for Essential member (15% off)', () => {
      const result = calculateApprovedPrice({
        pricingModel: PricingModel.FIXED,
        standardPrice: trainerAccreditationCents,
        tier: MembershipTier.ESSENTIAL,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.PROFESSIONAL_RECOGNITION,
      });
      expect(result.basePrice).toBe(25000);
      expect(result.discountPercentage).toBe(15.0);
      expect(result.discountAmount).toBe(3750);
      expect(result.finalPrice).toBe(21250);
    });

    it('should calculate 17500 cents ($175.00) for Professional member (30% off)', () => {
      const result = calculateApprovedPrice({
        pricingModel: PricingModel.FIXED,
        standardPrice: trainerAccreditationCents,
        tier: MembershipTier.PROFESSIONAL,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.PROFESSIONAL_RECOGNITION,
      });
      expect(result.basePrice).toBe(25000);
      expect(result.discountPercentage).toBe(30.0);
      expect(result.discountAmount).toBe(7500);
      expect(result.finalPrice).toBe(17500);
    });

    it('should calculate 15000 cents ($150.00) for Master member (40% off)', () => {
      const result = calculateApprovedPrice({
        pricingModel: PricingModel.FIXED,
        standardPrice: trainerAccreditationCents,
        tier: MembershipTier.MASTER,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.PROFESSIONAL_RECOGNITION,
      });
      expect(result.basePrice).toBe(25000);
      expect(result.discountPercentage).toBe(40.0);
      expect(result.discountAmount).toBe(10000);
      expect(result.finalPrice).toBe(15000);
    });
  });

  describe('User Test Case 2: 5% of $40,000 -> 1,700 / 1,400 / 0 (Master) (in minor units: 4,000,000 -> 170000 / 140000 / 0)', () => {
    const projectValueCents = 4000000; // $40,000 in cents

    it('should calculate 170,000 cents ($1,700.00) for Essential member (15% discount on $2,000 base)', () => {
      const result = calculateApprovedPrice({
        pricingModel: PricingModel.PERCENTAGE,
        baseAmount: projectValueCents,
        tier: MembershipTier.ESSENTIAL,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.CORE_SERVICE,
      });
      expect(result.basePrice).toBe(200000); // 5% of 4,000,000
      expect(result.discountPercentage).toBe(15.0);
      expect(result.discountAmount).toBe(30000);
      expect(result.finalPrice).toBe(170000);
    });

    it('should calculate 140,000 cents ($1,400.00) for Professional member (30% discount on $2,000 base)', () => {
      const result = calculateApprovedPrice({
        pricingModel: PricingModel.PERCENTAGE,
        baseAmount: projectValueCents,
        tier: MembershipTier.PROFESSIONAL,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.CORE_SERVICE,
      });
      expect(result.basePrice).toBe(200000);
      expect(result.discountPercentage).toBe(30.0);
      expect(result.discountAmount).toBe(60000);
      expect(result.finalPrice).toBe(140000);
    });

    it('should calculate 0 cents ($0.00) for Master member (Core Services included at no cost)', () => {
      const result = calculateApprovedPrice({
        pricingModel: PricingModel.PERCENTAGE,
        baseAmount: projectValueCents,
        tier: MembershipTier.MASTER,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.CORE_SERVICE,
      });
      expect(result.basePrice).toBe(200000);
      expect(result.discountPercentage).toBe(100.0);
      expect(result.discountAmount).toBe(200000);
      expect(result.finalPrice).toBe(0);
      expect(result.isIncludedWithPlan).toBe(true);
    });
  });

  describe('User Test Case 3: Quoted base with tier discount', () => {
    const quotedAmountCents = 50000; // $500.00

    it('should discount quoted amount according to tier', () => {
      const quotedEssential = calculateApprovedPrice({
        pricingModel: PricingModel.QUOTED,
        baseAmount: quotedAmountCents,
        tier: MembershipTier.ESSENTIAL,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.DIAGNOSTIC_TOOL,
      });
      expect(quotedEssential.basePrice).toBe(50000);
      expect(quotedEssential.discountPercentage).toBe(15.0);
      expect(quotedEssential.discountAmount).toBe(7500);
      expect(quotedEssential.finalPrice).toBe(42500);

      const quotedProf = calculateApprovedPrice({
        pricingModel: PricingModel.QUOTED,
        baseAmount: quotedAmountCents,
        tier: MembershipTier.PROFESSIONAL,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.DIAGNOSTIC_TOOL,
      });
      expect(quotedProf.discountPercentage).toBe(30.0);
      expect(quotedProf.discountAmount).toBe(15000);
      expect(quotedProf.finalPrice).toBe(35000);

      const quotedMaster = calculateApprovedPrice({
        pricingModel: PricingModel.QUOTED,
        baseAmount: quotedAmountCents,
        tier: MembershipTier.MASTER,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.DIAGNOSTIC_TOOL,
      });
      expect(quotedMaster.discountPercentage).toBe(40.0);
      expect(quotedMaster.discountAmount).toBe(20000);
      expect(quotedMaster.finalPrice).toBe(30000);
    });
  });

  describe('User Test Case 4: Zero payable', () => {
    it('should handle zero payable correctly ($0 finalPrice)', () => {
      const zeroResult = calculateApprovedPrice({
        pricingModel: PricingModel.QUOTED,
        baseAmount: 0,
        tier: MembershipTier.ESSENTIAL,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.CORE_SERVICE,
      });
      expect(zeroResult.basePrice).toBe(0);
      expect(zeroResult.discountAmount).toBe(0);
      expect(zeroResult.finalPrice).toBe(0);
    });
  });

  describe('Non-Requestable Models (NONE and IN_HUB)', () => {
    it('should return $0 finalPrice and not requestable for IN_HUB services', () => {
      const inHubResult = calculateApprovedPrice({
        pricingModel: PricingModel.IN_HUB,
        standardPrice: 0,
        tier: MembershipTier.ESSENTIAL,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.CORE_SERVICE,
      });
      expect(inHubResult.basePrice).toBe(0);
      expect(inHubResult.discountAmount).toBe(0);
      expect(inHubResult.finalPrice).toBe(0);
      expect(inHubResult.ruleCitation).toContain('MKT-114');
    });

    it('should return $0 finalPrice and not requestable for NONE info-only games', () => {
      const noneResult = calculateApprovedPrice({
        pricingModel: PricingModel.NONE,
        standardPrice: 0,
        tier: MembershipTier.MASTER,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.BUSINESS_SIMULATION,
      });
      expect(noneResult.basePrice).toBe(0);
      expect(noneResult.discountAmount).toBe(0);
      expect(noneResult.finalPrice).toBe(0);
      expect(noneResult.ruleCitation).toContain('SHP-10');
    });
  });

  describe('User Test Case 5: Free first use then paid for assessment instruments', () => {
    it('should apply free first use for active member and charge paid rate subsequently', () => {
      // First use is free (0 cents)
      const firstUse = calculateApprovedPrice({
        pricingModel: PricingModel.FREE_THEN_PAID,
        standardPrice: 4000, // $40.00
        tier: MembershipTier.ESSENTIAL,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.DIAGNOSTIC_TOOL,
        isFirstAssessmentUse: true,
      });
      expect(firstUse.basePrice).toBe(4000);
      expect(firstUse.discountPercentage).toBe(100.0);
      expect(firstUse.discountAmount).toBe(4000);
      expect(firstUse.finalPrice).toBe(0);
      expect(firstUse.isFirstUseFreeApplied).toBe(true);

      // Second use (paid): Essential gets 15% discount
      const secondUseEssential = calculateApprovedPrice({
        pricingModel: PricingModel.FREE_THEN_PAID,
        standardPrice: 4000,
        tier: MembershipTier.ESSENTIAL,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.DIAGNOSTIC_TOOL,
        isFirstAssessmentUse: false,
      });
      expect(secondUseEssential.basePrice).toBe(4000);
      expect(secondUseEssential.discountPercentage).toBe(15.0);
      expect(secondUseEssential.discountAmount).toBe(600);
      expect(secondUseEssential.finalPrice).toBe(3400);

      // Second use (paid): Professional gets 30% discount
      const secondUseProf = calculateApprovedPrice({
        pricingModel: PricingModel.FREE_THEN_PAID,
        standardPrice: 4000,
        tier: MembershipTier.PROFESSIONAL,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.DIAGNOSTIC_TOOL,
        isFirstAssessmentUse: false,
      });
      expect(secondUseProf.finalPrice).toBe(2800); // 4000 - 1200

      // Second use for Master with quarterly entitlement: 0 cents ($0.00)
      const secondUseMasterEntitled = calculateApprovedPrice({
        pricingModel: PricingModel.FREE_THEN_PAID,
        standardPrice: 4000,
        tier: MembershipTier.MASTER,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.DIAGNOSTIC_TOOL,
        isFirstAssessmentUse: false,
        isQuarterlyEntitlementEligible: true,
      });
      expect(secondUseMasterEntitled.finalPrice).toBe(0);
      expect(secondUseMasterEntitled.isQuarterlyEntitlementApplied).toBe(true);
    });
  });

  describe('BRU-47 Master Quarterly Entitlement Eligibility Engine', () => {
    it('should confirm strictly eligible items: 3 assessments and 5 priced simulation games', () => {
      // 3 Diagnostic assessments (priced under FREE_THEN_PAID)
      expect(
        isEligibleForMasterQuarterlyEntitlement({
          category: CatalogItemCategory.DIAGNOSTIC_TOOL,
          pricingModel: PricingModel.FREE_THEN_PAID,
          isActive: true,
        }),
      ).toBe(true);

      // 5 Priced Business simulation games (FIXED at $15)
      expect(
        isEligibleForMasterQuarterlyEntitlement({
          category: CatalogItemCategory.BUSINESS_SIMULATION,
          pricingModel: PricingModel.FIXED,
          isActive: true,
        }),
      ).toBe(true);

      // Ineligible items:
      // 1. Core Services
      expect(
        isEligibleForMasterQuarterlyEntitlement({ category: CatalogItemCategory.CORE_SERVICE }),
      ).toBe(false);

      // 2. Professional recognition (Accreditation, Certificates)
      expect(
        isEligibleForMasterQuarterlyEntitlement({
          category: CatalogItemCategory.PROFESSIONAL_RECOGNITION,
          pricingModel: PricingModel.FIXED,
        }),
      ).toBe(false);

      // 3. Info-only games (NONE pricing model)
      expect(
        isEligibleForMasterQuarterlyEntitlement({
          category: CatalogItemCategory.BUSINESS_SIMULATION,
          pricingModel: PricingModel.NONE,
        }),
      ).toBe(false);
    });

    it('should apply quarterly entitlement to priced simulation games ($15 -> $0)', () => {
      const simulationGameCents = 1500; // $15.00
      const result = calculateApprovedPrice({
        pricingModel: PricingModel.FIXED,
        standardPrice: simulationGameCents,
        tier: MembershipTier.MASTER,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.BUSINESS_SIMULATION,
        isQuarterlyEntitlementEligible: true,
      });

      expect(result.basePrice).toBe(1500);
      expect(result.discountPercentage).toBe(100.0);
      expect(result.discountAmount).toBe(1500);
      expect(result.finalPrice).toBe(0);
      expect(result.isQuarterlyEntitlementApplied).toBe(true);
    });

    it('should NOT apply quarterly entitlement to Professional Recognition items', () => {
      const result = calculateApprovedPrice({
        pricingModel: PricingModel.FIXED,
        standardPrice: 25000,
        tier: MembershipTier.MASTER,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.PROFESSIONAL_RECOGNITION,
        isQuarterlyEntitlementEligible: true,
      });

      // Should receive standard 40% Master discount, NOT free quarterly entitlement
      expect(result.discountPercentage).toBe(40.0);
      expect(result.finalPrice).toBe(15000);
      expect(result.isQuarterlyEntitlementApplied).toBe(false);
    });
  });

  describe('SHP-10 Info-Only Simulation Games (NONE Pricing Model)', () => {
    it('should return $0 with NONE model and indicate not requestable', () => {
      const result = calculateItemPricing({
        basePrice: 0,
        category: CatalogItemCategory.BUSINESS_SIMULATION,
        pricingModel: PricingModel.NONE,
        tier: MembershipTier.ESSENTIAL,
        membershipStatus: MembershipStatus.ACTIVE,
      });

      expect(result.basePrice).toBe(0);
      expect(result.finalPrice).toBe(0);
      expect(result.ruleCitation).toContain('SHP-10');
    });
  });

  describe('Round half-up once on odd minor units', () => {
    it('should round half-up once', () => {
      // 5% of 3333333 cents = 166666.65 cents -> rounds to 166667 cents
      const oddPercentage = calculateApprovedPrice({
        pricingModel: PricingModel.PERCENTAGE,
        baseAmount: 3333333,
        tier: MembershipTier.ESSENTIAL,
        membershipStatus: MembershipStatus.ACTIVE,
        category: CatalogItemCategory.CORE_SERVICE,
      });
      expect(oddPercentage.basePrice).toBe(166667);
      // 166667 * 0.15 = 25000.05 -> rounds to 25000 cents
      expect(oddPercentage.discountAmount).toBe(25000);
      expect(oddPercentage.finalPrice).toBe(141667);
    });
  });
});
