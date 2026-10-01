import {
  MembershipTier,
  MembershipStatus,
  CatalogItemCategory,
  PricingModel,
} from '@prisma/client';
import { TIER_DISCOUNT_RATES, getTierDiscountRate } from '../../membership/domain/pricing';
import { isEligibleForMasterQuarterlyEntitlement } from './quarterly-entitlement';

export interface PricingCalculationInput {
  basePrice: number; // Integer minor units (cents)
  category: CatalogItemCategory;
  pricingModel?: PricingModel;
  isActive?: boolean;
  tier: MembershipTier;
  membershipStatus: MembershipStatus;
  isQuarterlyEntitlementEligible?: boolean;
  isFirstAssessmentUse?: boolean;
}

export interface PricingCalculationResult {
  basePrice: number; // Integer minor units (cents)
  discountPercentage: number; // Rate e.g. 15.0, 30.0, 40.0
  discountAmount: number; // Integer minor units (cents)
  finalPrice: number; // Integer minor units (cents)
  currency: 'USD';
  isQuarterlyEntitlementApplied: boolean;
  isFirstUseFreeApplied: boolean;
  isIncludedWithPlan: boolean;
  ruleCitation: string;
}

/**
 * Pure domain canonical pricing calculator.
 * Strictly calculates discounts and final prices according to:
 * - Integer minor units (cents) storage & calculation convention
 * - SEC-33 (Single source of truth, computed server-side)
 * - MEM-13 (Active Tier Discount Rates: Essential 15%, Professional 30%, Master 40%)
 * - BRU-47, MEM-14, MEM-16, MEM-76 (Master Quarterly Tool Entitlement: 3 assessments + 5 priced games)
 * - First-use-free per member per assessment instrument
 * - MEM-33a (Grace Period: 0% discount, full standard price)
 * - MEM-33b (Expired: Charged at Essential 15% rate)
 * - SHP-10 (NONE pricing model: info-only simulation games, non-requestable)
 */
export function calculateItemPricing(input: PricingCalculationInput): PricingCalculationResult {
  const basePrice = Math.max(0, Math.round(input.basePrice));
  const {
    category,
    pricingModel = PricingModel.QUOTED,
    tier,
    membershipStatus,
    isQuarterlyEntitlementEligible,
    isFirstAssessmentUse,
  } = input;

  // 0. Non-requestable items with no price (e.g. direct in-hub access with 0 price)
  if (
    basePrice === 0 &&
    (pricingModel === PricingModel.NONE || pricingModel === PricingModel.IN_HUB)
  ) {
    return {
      basePrice: 0,
      discountPercentage: 0.0,
      discountAmount: 0,
      finalPrice: 0,
      currency: 'USD',
      isQuarterlyEntitlementApplied: false,
      isFirstUseFreeApplied: false,
      isIncludedWithPlan: false,
      ruleCitation:
        pricingModel === PricingModel.IN_HUB
          ? 'MKT-114: In-hub service accessible directly in platform; not requestable.'
          : 'SHP-10: Informational item with no price; not requestable.',
    };
  }

  // 1. Diagnostic Tools: First use is free per member per assessment instrument
  if (
    category === CatalogItemCategory.DIAGNOSTIC_TOOL &&
    pricingModel === PricingModel.FREE_THEN_PAID &&
    isFirstAssessmentUse === true &&
    membershipStatus === MembershipStatus.ACTIVE
  ) {
    return {
      basePrice,
      discountPercentage: 100.0,
      discountAmount: basePrice,
      finalPrice: 0,
      currency: 'USD',
      isQuarterlyEntitlementApplied: false,
      isFirstUseFreeApplied: true,
      isIncludedWithPlan: true,
      ruleCitation: 'Free-then-paid: First assessment tool usage is free for active members.',
    };
  }

  // 2. Master Tier Quarterly Entitlement (BRU-47, MEM-14, MEM-16, MEM-76)
  // Strictly eligible: 3 Diagnostic Assessments + 5 Priced Business Simulation Games
  if (
    tier === MembershipTier.MASTER &&
    membershipStatus === MembershipStatus.ACTIVE &&
    isQuarterlyEntitlementEligible === true &&
    isEligibleForMasterQuarterlyEntitlement({
      category,
      pricingModel,
      isActive: input.isActive ?? true,
    })
  ) {
    return {
      basePrice,
      discountPercentage: 100.0,
      discountAmount: basePrice,
      finalPrice: 0,
      currency: 'USD',
      isQuarterlyEntitlementApplied: true,
      isFirstUseFreeApplied: false,
      isIncludedWithPlan: true,
      ruleCitation:
        'BRU-47, MEM-14, MEM-16, MEM-76: Master contractual quarterly complimentary tool entitlement applied.',
    };
  }

  // 3. Master Tier Core Hub Services Benefit: Services included at no cost (excluding FIXED items like Accreditations)
  if (
    tier === MembershipTier.MASTER &&
    membershipStatus === MembershipStatus.ACTIVE &&
    pricingModel !== PricingModel.FIXED &&
    (category === CatalogItemCategory.CORE_SERVICE ||
      pricingModel === PricingModel.INCLUDED_OR_QUOTED ||
      pricingModel === PricingModel.PERCENTAGE)
  ) {
    return {
      basePrice,
      discountPercentage: 100.0,
      discountAmount: basePrice,
      finalPrice: 0,
      currency: 'USD',
      isQuarterlyEntitlementApplied: false,
      isFirstUseFreeApplied: false,
      isIncludedWithPlan: true,
      ruleCitation:
        'MEM-03, MEM-13: Master plan includes Core Hub Services / Trainer Help Desk at no additional cost.',
    };
  }

  // 4. Grace Period Policy (MEM-33a): Standard price in full (0% discount)
  if (membershipStatus === MembershipStatus.GRACE_PERIOD) {
    return {
      basePrice,
      discountPercentage: 0.0,
      discountAmount: 0,
      finalPrice: basePrice,
      currency: 'USD',
      isQuarterlyEntitlementApplied: false,
      isFirstUseFreeApplied: false,
      isIncludedWithPlan: false,
      ruleCitation:
        'MEM-33a: Membership is in Grace Period. Standard price in full with 0% discount.',
    };
  }

  // 5. Expired Membership Policy (MEM-33b): Charged at Essential 15% rate
  if (membershipStatus === MembershipStatus.EXPIRED) {
    const discountPercentage = TIER_DISCOUNT_RATES[MembershipTier.ESSENTIAL];
    const discountAmount = Math.round(basePrice * (discountPercentage / 100));
    const finalPrice = Math.max(0, basePrice - discountAmount);
    return {
      basePrice,
      discountPercentage,
      discountAmount,
      finalPrice,
      currency: 'USD',
      isQuarterlyEntitlementApplied: false,
      isFirstUseFreeApplied: false,
      isIncludedWithPlan: false,
      ruleCitation:
        'MEM-33b: Membership is Expired. Standard Essential rate of 15% discount applies.',
    };
  }

  // 6. Inactive, Suspended, or Cancelled Statuses (0% discount)
  if (membershipStatus !== MembershipStatus.ACTIVE) {
    return {
      basePrice,
      discountPercentage: 0.0,
      discountAmount: 0,
      finalPrice: basePrice,
      currency: 'USD',
      isQuarterlyEntitlementApplied: false,
      isFirstUseFreeApplied: false,
      isIncludedWithPlan: false,
      ruleCitation: 'MEM-13: Inactive membership status receives standard non-discounted rate.',
    };
  }

  // 7. Active Membership Tiers Canonical Discounts (MEM-13, centralized via TIER_DISCOUNT_RATES)
  const discountPercentage = getTierDiscountRate(tier);
  const discountAmount = Math.round(basePrice * (discountPercentage / 100));
  const finalPrice = Math.max(0, basePrice - discountAmount);

  return {
    basePrice,
    discountPercentage,
    discountAmount,
    finalPrice,
    currency: 'USD',
    isQuarterlyEntitlementApplied: false,
    isFirstUseFreeApplied: false,
    isIncludedWithPlan: false,
    ruleCitation: `MEM-13: Active ${tier} tier receives ${discountPercentage}% discount.`,
  };
}

/**
 * Calculates payable amount when Admin approves a request.
 * All prices and baseAmounts in integer minor units (cents).
 * - PERCENTAGE model: basePrice = round(baseAmount * 0.05). Applies tier discount (1,700 / 1,400 / 0).
 * - QUOTED model: basePrice = approved baseAmount. Applies tier discount.
 * - FIXED model: standard item basePrice. Applies tier discount (e.g. 25000 -> 21250 / 17500 / 15000).
 * - FREE_THEN_PAID: $0 if first use or Master quarterly entitlement; else standard item basePrice with tier discount.
 * - NONE model: Not requestable ($0).
 */
export function calculateApprovedPrice(params: {
  pricingModel: PricingModel;
  standardPrice?: number | null; // integer minor units (cents)
  baseAmount?: number | null; // e.g. project_value for percentage or custom quote in cents
  percentageRate?: number | null; // e.g. 5.0 for percentage model
  tier: MembershipTier;
  membershipStatus: MembershipStatus;
  category: CatalogItemCategory;
  isQuarterlyEntitlementEligible?: boolean;
  isFirstAssessmentUse?: boolean;
  isActive?: boolean;
}): PricingCalculationResult {
  const {
    pricingModel,
    standardPrice = 0,
    baseAmount = 0,
    percentageRate = 5.0,
    tier,
    membershipStatus,
    category,
    isQuarterlyEntitlementEligible,
    isFirstAssessmentUse,
    isActive = true,
  } = params;

  if (
    (pricingModel === PricingModel.NONE || pricingModel === PricingModel.IN_HUB) &&
    (standardPrice ?? 0) === 0 &&
    (baseAmount ?? 0) === 0
  ) {
    return calculateItemPricing({
      basePrice: 0,
      category,
      pricingModel,
      isActive,
      tier,
      membershipStatus,
      isQuarterlyEntitlementEligible: false,
      isFirstAssessmentUse: false,
    });
  }

  let computedBasePrice = 0;

  if (pricingModel === PricingModel.PERCENTAGE) {
    // Percentage of client project value (in integer cents) using rate configured in seed
    const rate = Number(percentageRate ?? 5.0) / 100;
    const projectVal = Math.max(0, Math.round(Number(baseAmount ?? 0)));
    computedBasePrice = Math.round(projectVal * rate);
  } else if (pricingModel === PricingModel.QUOTED) {
    computedBasePrice = Math.max(0, Math.round(Number(baseAmount ?? 0)));
  } else if (pricingModel === PricingModel.INCLUDED_OR_QUOTED) {
    if (tier === MembershipTier.MASTER && membershipStatus === MembershipStatus.ACTIVE) {
      computedBasePrice = 0;
    } else {
      computedBasePrice = Math.max(0, Math.round(Number(baseAmount ?? standardPrice ?? 0)));
    }
  } else {
    computedBasePrice = Math.max(0, Math.round(Number(standardPrice ?? 0)));
  }

  return calculateItemPricing({
    basePrice: computedBasePrice,
    category,
    pricingModel,
    isActive,
    tier,
    membershipStatus,
    isQuarterlyEntitlementEligible,
    isFirstAssessmentUse,
  });
}
