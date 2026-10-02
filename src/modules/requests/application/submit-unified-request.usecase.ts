import {
  PrismaClient,
  CatalogItemCategory,
  PricingModel,
  EngagementRequestStatus,
  MembershipTier,
  MembershipStatus,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import {
  NotFoundError,
  AuthenticationError,
  ValidationError,
  ConflictError,
} from '../../../shared/errors';
import { calculateItemPricing } from '../domain/pricing-calculator';
import {
  getContractualQuarter,
  isEligibleForMasterQuarterlyEntitlement,
} from '../domain/quarterly-entitlement';
import { generateRequestReference } from '../domain/reference-generator';

export interface SubmitUnifiedRequestInput {
  itemSlug: string;
  brief?: Record<string, unknown>;
  customRequirements?: string;
  acknowledgement?: boolean;
}

export interface SubmitUnifiedRequestResult {
  id: string;
  referenceCode: string;
  itemName: string;
  itemSlug: string;
  category: CatalogItemCategory;
  status: EngagementRequestStatus;
  pricingModel: PricingModel;
  basePrice: number;
  discountPercentage: number;
  finalPrice: number;
  currency: string;
  isQuarterlyEntitlementApplied: boolean;
  isFirstUseFreeApplied?: boolean;
  isIncludedWithPlan: boolean;
  quarterIndex?: number;
  membershipYear?: number;
  message: string;
  createdAt: string;
}

export class SubmitUnifiedRequestUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(
    userId: string,
    input: SubmitUnifiedRequestInput,
    meta: { ipAddress?: string; requestId?: string },
  ): Promise<SubmitUnifiedRequestResult> {
    // 1. Verify authenticated member
    const member = await this.prisma.member.findUnique({
      where: { userId },
      include: {
        memberships: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!member) {
      throw new AuthenticationError('Member profile not found.');
    }

    // 2. Fetch catalog item
    const item = await this.prisma.catalogItem.findFirst({
      where: {
        slug: input.itemSlug,
        isActive: true,
      },
    });

    if (!item) {
      throw new NotFoundError(`Catalog item with slug '${input.itemSlug}' not found.`);
    }

    // 2.5 Ensure item is requestable (items with PricingModel.NONE or IN_HUB are not requestable)
    if (item.pricingModel === PricingModel.NONE || item.pricingModel === PricingModel.IN_HUB) {
      throw new ValidationError(
        `Catalog item '${item.nameEn}' has pricing model '${item.pricingModel}' and is not requestable.`,
      );
    }

    // 3. REQ-14: Active duplicate request prevention
    // Prevent submitting duplicate requests if one is currently active (SUBMITTED, UNDER_REVIEW, AWAITING_RESPONSE, AWAITING_PAYMENT)
    const existingActiveRequest = await this.prisma.engagementRequest.findFirst({
      where: {
        memberId: member.id,
        catalogItemId: item.id,
        status: {
          in: [
            EngagementRequestStatus.SUBMITTED,
            EngagementRequestStatus.UNDER_REVIEW,
            EngagementRequestStatus.AWAITING_RESPONSE,
            EngagementRequestStatus.AWAITING_PAYMENT,
          ],
        },
      },
      select: { referenceCode: true, status: true },
    });

    if (existingActiveRequest) {
      throw new ConflictError(
        `REQ-14: An active request (${existingActiveRequest.referenceCode}) for item '${item.nameEn}' is already in progress with status '${existingActiveRequest.status}'.`,
        {
          referenceCode: existingActiveRequest.referenceCode,
          status: existingActiveRequest.status,
          catalogItemId: item.id,
          slug: item.slug,
        },
      );
    }

    // 4. Validate brief schema requirements based on pricingModel
    if (item.pricingModel === PricingModel.PERCENTAGE) {
      const projectValue = Number(input.brief?.['project_value']);
      if (!projectValue || isNaN(projectValue) || projectValue <= 0) {
        throw new ValidationError(
          'A valid positive project_value is required in the brief for percentage-based services.',
          { field: 'brief.project_value' },
        );
      }
    }

    // 5. Determine tier & membership status
    const currentMembership = member.memberships[0];
    const tier = currentMembership?.tier ?? MembershipTier.ESSENTIAL;
    const membershipStatus = currentMembership?.status ?? MembershipStatus.ACTIVE;

    // 6. Pricing & Entitlement Evaluation
    let isQuarterlyEligible = false;
    let quarterInfo: ReturnType<typeof getContractualQuarter> | undefined;
    let isFirstAssessmentUse = false;

    if (item.category === CatalogItemCategory.DIAGNOSTIC_TOOL) {
      // Free-then-paid: evaluate first assessment use per assessment instrument
      if (membershipStatus === MembershipStatus.ACTIVE) {
        const previousUsages = await this.prisma.engagementRequest.count({
          where: {
            memberId: member.id,
            catalogItemId: item.id,
            status: {
              notIn: [EngagementRequestStatus.CANCELLED, EngagementRequestStatus.REJECTED],
            },
          },
        });
        isFirstAssessmentUse = previousUsages === 0;
      }
    }

    // Master Quarterly Entitlement (BRU-47, MEM-14, MEM-16, MEM-76, SHP-84)
    // Applies to both DIAGNOSTIC_TOOL and BUSINESS_SIMULATION when priced & active
    const isEntitlementItem = isEligibleForMasterQuarterlyEntitlement({
      category: item.category,
      pricingModel: item.pricingModel,
      isActive: item.isActive,
    });

    if (
      tier === MembershipTier.MASTER &&
      membershipStatus === MembershipStatus.ACTIVE &&
      isEntitlementItem
    ) {
      quarterInfo = getContractualQuarter(currentMembership!.startDate, new Date());

      const activeQuarterUsages = await this.prisma.engagementRequest.count({
        where: {
          memberId: member.id,
          isQuarterlyEntitlement: true,
          quarterIndex: quarterInfo.quarterIndex,
          membershipYear: quarterInfo.membershipYear,
          status: {
            notIn: [EngagementRequestStatus.CANCELLED, EngagementRequestStatus.REJECTED],
          },
        },
      });

      isQuarterlyEligible = activeQuarterUsages === 0;
    }

    // Event license pricing for simulation games: unit * trainees (SHP-84)
    let basePrice = Number(item.basePrice);
    if (
      item.category === CatalogItemCategory.BUSINESS_SIMULATION &&
      item.pricingModel === PricingModel.FIXED
    ) {
      const trainees = Number(
        input.brief?.['trainees'] ??
          input.brief?.['traineeCount'] ??
          input.brief?.['participants'] ??
          input.brief?.['participantCount'] ??
          1,
      );
      if (!isNaN(trainees) && trainees > 0) {
        basePrice = basePrice * Math.round(trainees);
      }
    }

    const pricing = calculateItemPricing({
      basePrice,
      category: item.category,
      pricingModel: item.pricingModel,
      tier,
      membershipStatus,
      isQuarterlyEntitlementEligible: isQuarterlyEligible,
      isFirstAssessmentUse,
    });

    // 7. Determine initial workflow status
    let initialStatus: EngagementRequestStatus;
    if (item.category === CatalogItemCategory.DIAGNOSTIC_TOOL) {
      initialStatus =
        pricing.finalPrice === 0
          ? EngagementRequestStatus.PAYMENT_CONFIRMED
          : EngagementRequestStatus.AWAITING_PAYMENT;
    } else {
      initialStatus =
        pricing.finalPrice === 0
          ? EngagementRequestStatus.UNDER_REVIEW
          : EngagementRequestStatus.AWAITING_PAYMENT;
    }

    const referenceCode = generateRequestReference();

    // 8. Atomically persist engagement request and audit log
    const createdRequest = await this.prisma.$transaction(async (tx) => {
      const reqRecord = await tx.engagementRequest.create({
        data: {
          referenceCode,
          memberId: member.id,
          catalogItemId: item.id,
          category: item.category,
          status: initialStatus,
          pricingModel: item.pricingModel,
          tierAtRequest: tier,
          membershipStatusAtRequest: membershipStatus,
          basePrice: pricing.basePrice,
          discountPercentage: pricing.discountPercentage,
          finalPrice: pricing.finalPrice,
          currency: pricing.currency,
          isQuarterlyEntitlement: pricing.isQuarterlyEntitlementApplied,
          quarterIndex: pricing.isQuarterlyEntitlementApplied ? quarterInfo?.quarterIndex : null,
          membershipYear: pricing.isQuarterlyEntitlementApplied
            ? quarterInfo?.membershipYear
            : null,
          brief: input.brief ? JSON.parse(JSON.stringify(input.brief)) : undefined,
          customRequirements: input.customRequirements?.trim() || null,
          acknowledgement: input.acknowledgement ?? true,
          intakeData: input.brief ? JSON.parse(JSON.stringify(input.brief)) : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: 'MEMBER',
          action: 'SUBMIT_REQUEST',
          resource: 'ENGAGEMENT_REQUEST',
          resourceId: reqRecord.id,
          ipAddress: meta.ipAddress,
          requestId: meta.requestId,
          newState: {
            referenceCode: reqRecord.referenceCode,
            itemSlug: item.slug,
            category: item.category,
            status: reqRecord.status,
            finalPrice: pricing.finalPrice,
            isQuarterlyEntitlementApplied: pricing.isQuarterlyEntitlementApplied,
            isFirstUseFreeApplied: pricing.isFirstUseFreeApplied,
            quarterIndex: reqRecord.quarterIndex,
          },
        },
      });

      return reqRecord;
    });

    let message: string;
    if (pricing.isFirstUseFreeApplied) {
      message =
        'Diagnostic tool order successfully placed using your complimentary first-use benefit. Assessment setup is in review.';
    } else if (pricing.isQuarterlyEntitlementApplied) {
      message =
        'Diagnostic tool order successfully placed using your Master quarterly complimentary entitlement. Assessment setup is in review.';
    } else if (createdRequest.status === EngagementRequestStatus.UNDER_REVIEW) {
      message = 'Request submitted successfully and is now under review by the IBDL team.';
    } else {
      message = 'Request created. Please complete payment to proceed with fulfillment.';
    }

    return {
      id: createdRequest.id,
      referenceCode: createdRequest.referenceCode,
      itemName: item.nameEn,
      itemSlug: item.slug,
      category: createdRequest.category,
      status: createdRequest.status,
      pricingModel: createdRequest.pricingModel,
      basePrice: Number(createdRequest.basePrice),
      discountPercentage: Number(createdRequest.discountPercentage),
      finalPrice: Number(createdRequest.finalPrice),
      currency: createdRequest.currency,
      isQuarterlyEntitlementApplied: createdRequest.isQuarterlyEntitlement,
      isFirstUseFreeApplied: pricing.isFirstUseFreeApplied,
      isIncludedWithPlan: pricing.isIncludedWithPlan,
      quarterIndex: createdRequest.quarterIndex ?? undefined,
      membershipYear: createdRequest.membershipYear ?? undefined,
      message,
      createdAt: createdRequest.createdAt.toISOString(),
    };
  }
}
