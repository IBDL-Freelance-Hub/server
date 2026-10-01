import {
  PrismaClient,
  EngagementRequestStatus,
  CatalogItemCategory,
  MembershipTier,
  MembershipStatus,
  PricingModel,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError } from '../../../shared/errors';

export interface MemberPricingBreakdownDTO {
  pricingModel: PricingModel;
  isQuotePending: boolean;
  quoteStatus: 'PENDING_APPROVAL' | 'CONFIRMED';
  quoteNote?: {
    en: string;
    ar: string;
  } | null;
  baseAmount: number | null;
  basePrice: number | null;
  discountPercentage: number | null;
  discountAmount: number | null;
  finalPrice: number | null;
  currency: string;
  isFirstUseFreeApplied: boolean;
  isQuarterlyEntitlementApplied: boolean;
  quarterIndex: number | null;
  membershipYear: number | null;
}

export interface MemberLifecycleTimestampsDTO {
  createdAt: string;
  infoRequestedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  rejectedAt: string | null;
  updatedAt: string;
}

export interface MemberRequestDetailDTO {
  id: string;
  referenceCode: string;
  category: CatalogItemCategory;
  status: EngagementRequestStatus;
  catalogItem: {
    id: string;
    slug: string;
    nameEn: string;
    nameAr: string | null;
    descriptionEn: string | null;
  };
  pricingSnapshot: {
    tierAtRequest: MembershipTier;
    membershipStatusAtRequest: MembershipStatus;
    basePrice: number | null;
    discountPercentage: number | null;
    finalPrice: number | null;
    currency: string;
    isQuarterlyEntitlement: boolean;
    quarterIndex: number | null;
    membershipYear: number | null;
  };
  pricing: MemberPricingBreakdownDTO;
  intake: {
    brief: unknown;
    customRequirements: string | null;
    intakeData: unknown;
  };
  workflow: {
    reviewNotes: string | null;
    cancellationReason: string | null;
    rejectionReason: string | null;
  };
  timestamps: MemberLifecycleTimestampsDTO;
  createdAt: string;
  updatedAt: string;
}

export class GetMemberRequestByRefUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(userId: string, identifier: string): Promise<MemberRequestDetailDTO> {
    // 1. Strict Tenant Isolation (SEC-33, MEM-78): Match identifier (UUID or referenceCode) AND member.userId
    const request = await this.prisma.engagementRequest.findFirst({
      where: {
        OR: [{ id: identifier }, { referenceCode: identifier }],
      },
      include: {
        member: {
          select: { userId: true },
        },
        catalogItem: {
          select: {
            id: true,
            slug: true,
            nameEn: true,
            nameAr: true,
            descriptionEn: true,
          },
        },
      },
    });

    if (!request || request.member.userId !== userId) {
      // Intentionally return 404 to avoid ID enumeration leaks
      throw new NotFoundError(`Engagement request '${identifier}' not found.`);
    }

    // Determine if quote is pending admin approval
    const isQuotePending =
      (request.pricingModel === PricingModel.PERCENTAGE ||
        request.pricingModel === PricingModel.QUOTED) &&
      (request.status === EngagementRequestStatus.SUBMITTED ||
        request.status === EngagementRequestStatus.UNDER_REVIEW ||
        request.status === EngagementRequestStatus.AWAITING_RESPONSE);

    const isFirstUseFreeApplied =
      request.category === CatalogItemCategory.DIAGNOSTIC_TOOL &&
      request.pricingModel === PricingModel.FREE_THEN_PAID &&
      !request.isQuarterlyEntitlement &&
      Number(request.finalPrice ?? 0) === 0;

    const pricing: MemberPricingBreakdownDTO = {
      pricingModel: request.pricingModel,
      isQuotePending,
      quoteStatus: isQuotePending ? 'PENDING_APPROVAL' : 'CONFIRMED',
      quoteNote: isQuotePending
        ? {
            en: 'Quote is pending operational review and approval',
            ar: 'عرض السعر قيد المراجعة والاعتماد من قبل العمليات',
          }
        : null,
      baseAmount: request.baseAmount,
      basePrice: isQuotePending
        ? null
        : request.basePrice !== null
          ? Number(request.basePrice)
          : null,
      discountPercentage: isQuotePending
        ? null
        : request.discountPercentage !== null
          ? Number(request.discountPercentage)
          : null,
      discountAmount: isQuotePending
        ? null
        : request.discountAmount !== null
          ? Number(request.discountAmount)
          : null,
      finalPrice: isQuotePending
        ? null
        : request.finalPrice !== null
          ? Number(request.finalPrice)
          : null,
      currency: request.currency,
      isFirstUseFreeApplied,
      isQuarterlyEntitlementApplied: request.isQuarterlyEntitlement,
      quarterIndex: request.quarterIndex,
      membershipYear: request.membershipYear,
    };

    const timestamps: MemberLifecycleTimestampsDTO = {
      createdAt: request.createdAt.toISOString(),
      infoRequestedAt: request.infoRequestedAt?.toISOString() ?? null,
      approvedAt: request.approvedAt?.toISOString() ?? null,
      paidAt: request.paidAt?.toISOString() ?? null,
      fulfilledAt: request.fulfilledAt?.toISOString() ?? null,
      cancelledAt: request.cancelledAt?.toISOString() ?? null,
      rejectedAt: request.rejectedAt?.toISOString() ?? null,
      updatedAt: request.updatedAt.toISOString(),
    };

    return {
      id: request.id,
      referenceCode: request.referenceCode,
      category: request.category,
      status: request.status,
      catalogItem: {
        id: request.catalogItem.id,
        slug: request.catalogItem.slug,
        nameEn: request.catalogItem.nameEn,
        nameAr: request.catalogItem.nameAr,
        descriptionEn: request.catalogItem.descriptionEn,
      },
      pricingSnapshot: {
        tierAtRequest: request.tierAtRequest,
        membershipStatusAtRequest: request.membershipStatusAtRequest,
        basePrice: isQuotePending ? null : Number(request.basePrice),
        discountPercentage: isQuotePending ? null : Number(request.discountPercentage),
        finalPrice: isQuotePending ? null : Number(request.finalPrice),
        currency: request.currency,
        isQuarterlyEntitlement: request.isQuarterlyEntitlement,
        quarterIndex: request.quarterIndex,
        membershipYear: request.membershipYear,
      },
      pricing,
      intake: {
        brief: request.brief,
        customRequirements: request.customRequirements,
        intakeData: request.intakeData,
      },
      workflow: {
        reviewNotes: request.reviewNotes,
        cancellationReason: request.cancellationReason,
        rejectionReason: request.rejectionReason,
      },
      timestamps,
      createdAt: timestamps.createdAt,
      updatedAt: timestamps.updatedAt,
    };
  }
}
