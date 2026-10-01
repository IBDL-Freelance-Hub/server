import { CatalogItemCategory, PricingModel } from '@prisma/client';

export interface ContractualQuarterInfo {
  membershipYear: number;
  quarterIndex: number; // 1, 2, 3, or 4
  quarterStart: Date;
  quarterEnd: Date;
  yearStart: Date;
  yearEnd: Date;
}

/**
 * Adds contractual months in UTC, safely clamping to the end of month if the target month has fewer days.
 */
export function addContractualMonths(baseDate: Date, months: number): Date {
  const result = new Date(baseDate.getTime());
  const originalDay = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  // Determine last day of the resulting target month
  const year = result.getUTCFullYear();
  const month = result.getUTCMonth();
  const daysInTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  result.setUTCDate(Math.min(originalDay, daysInTargetMonth));
  return result;
}

/**
 * Computes contractual quarter information for a member strictly from membership startDate (MEM-14, MEM-16, MEM-76).
 * Quarters are partitioned as:
 * - Q1: [startDate, startDate + 3 months)
 * - Q2: [startDate + 3 months, startDate + 6 months)
 * - Q3: [startDate + 6 months, startDate + 9 months)
 * - Q4: [startDate + 9 months, startDate + 12 months)
 *
 * Rules:
 * - Counted strictly from membership start date (not calendar quarters).
 * - Exactly 1 tool allowance per quarter (max 4 per membership year).
 * - No rollover across quarters (unused Q1 entitlement is forfeited upon entering Q2).
 */
export function getContractualQuarter(
  membershipStartDate: Date,
  referenceDate: Date = new Date(),
): ContractualQuarterInfo {
  const start = new Date(membershipStartDate);
  const target = new Date(referenceDate);

  if (isNaN(start.getTime())) {
    throw new Error('Invalid membership start date provided');
  }

  // If target date is before start date, treat as current start of membership
  const effectiveTarget = target.getTime() < start.getTime() ? start : target;

  let membershipYear = 1;
  let yearStart = new Date(start.getTime());
  let yearEnd = addContractualMonths(yearStart, 12);

  // Fast forward to correct membership year if member has renewed multi-year
  while (effectiveTarget.getTime() >= yearEnd.getTime()) {
    membershipYear += 1;
    yearStart = yearEnd;
    yearEnd = addContractualMonths(start, membershipYear * 12);
  }

  const q1End = addContractualMonths(yearStart, 3);
  const q2End = addContractualMonths(yearStart, 6);
  const q3End = addContractualMonths(yearStart, 9);
  const q4End = yearEnd;

  let quarterIndex = 1;
  let quarterStart = yearStart;
  let quarterEnd = q1End;

  if (effectiveTarget.getTime() >= q3End.getTime()) {
    quarterIndex = 4;
    quarterStart = q3End;
    quarterEnd = q4End;
  } else if (effectiveTarget.getTime() >= q2End.getTime()) {
    quarterIndex = 3;
    quarterStart = q2End;
    quarterEnd = q3End;
  } else if (effectiveTarget.getTime() >= q1End.getTime()) {
    quarterIndex = 2;
    quarterStart = q1End;
    quarterEnd = q2End;
  }

  return {
    membershipYear,
    quarterIndex,
    quarterStart,
    quarterEnd,
    yearStart,
    yearEnd,
  };
}

/**
 * Evaluates whether a Master member can consume their quarterly complimentary diagnostic tool entitlement.
 *
 * @param usedEntitlementsInQuarter Number of active/completed entitlement requests in this exact quarter
 */
export function isQuarterlyEntitlementAvailable(usedEntitlementsInQuarter: number): boolean {
  return usedEntitlementsInQuarter === 0;
}

/**
 * BRU-47, MEM-14, MEM-16, MEM-76: Determines whether a catalog item is eligible for the Master quarterly complimentary entitlement.
 * Derived rule:
 * - Category in (BUSINESS_SIMULATION, DIAGNOSTIC_TOOL)
 * - Pricing model is priced (not NONE, not IN_HUB)
 * - Item is active (isActive is not false)
 */
export function isEligibleForMasterQuarterlyEntitlement(item: {
  category: CatalogItemCategory;
  pricingModel?: PricingModel | null;
  isActive?: boolean;
}): boolean {
  if (item.isActive === false) {
    return false;
  }

  const isEligibleCategory =
    item.category === CatalogItemCategory.BUSINESS_SIMULATION ||
    item.category === CatalogItemCategory.DIAGNOSTIC_TOOL;

  if (!isEligibleCategory) {
    return false;
  }

  const isPriced =
    item.pricingModel !== undefined &&
    item.pricingModel !== null &&
    item.pricingModel !== PricingModel.NONE &&
    item.pricingModel !== PricingModel.IN_HUB;

  return isPriced;
}
