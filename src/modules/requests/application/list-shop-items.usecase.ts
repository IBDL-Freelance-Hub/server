import {
  Prisma,
  PrismaClient,
  CatalogItemCategory,
  EngagementRequestStatus,
  MembershipStatus,
  MembershipTier,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { calculateItemPricing } from '../domain/pricing-calculator';
import { isEligibleForMasterQuarterlyEntitlement } from '../domain/quarterly-entitlement';

export interface ListShopItemsInput {
  kind?: string; // 'tool' | 'service'
  search?: string;
  memberId?: string;
}

export class ListShopItemsUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(input: ListShopItemsInput) {
    const { kind, search, memberId } = input;

    // Map kind to category
    let categories: CatalogItemCategory[] = [];
    if (kind === 'tool') {
      categories = [CatalogItemCategory.DIAGNOSTIC_TOOL];
    } else if (kind === 'service') {
      categories = [
        CatalogItemCategory.CORE_SERVICE,
        CatalogItemCategory.BUSINESS_SIMULATION,
        CatalogItemCategory.PROFESSIONAL_RECOGNITION,
      ];
    } else {
      categories = Object.values(CatalogItemCategory);
    }

    const whereClause: Prisma.CatalogItemWhereInput = {
      isActive: true,
      category: { in: categories },
    };

    if (search && search.trim()) {
      whereClause.OR = [
        { nameEn: { contains: search, mode: 'insensitive' } },
        { nameAr: { contains: search, mode: 'insensitive' } },
        { descriptionEn: { contains: search, mode: 'insensitive' } },
        { descriptionAr: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.catalogItem.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    let memberTier: MembershipTier = MembershipTier.ESSENTIAL;
    let memberStatus: MembershipStatus = MembershipStatus.PENDING_PAYMENT;
    let memberReqs: {
      catalogItemId: string;
      status: EngagementRequestStatus;
      catalogItem: { slug: string };
    }[] = [];
    let isMasterActive = false;
    let isAuthenticated = false;
    const usedToolIds = new Set<string>();
    let hasTrainerAccreditation = false;

    if (memberId) {
      const member = await this.prisma.member.findUnique({
        where: { id: memberId },
        include: { memberships: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      const currentMembership = member?.memberships[0];

      if (member && currentMembership) {
        isAuthenticated = true;
        memberTier = currentMembership.tier;
        memberStatus = currentMembership.status;
        isMasterActive =
          memberTier === MembershipTier.MASTER && memberStatus === MembershipStatus.ACTIVE;
      }

      memberReqs = await this.prisma.engagementRequest.findMany({
        where: { memberId },
        select: { catalogItemId: true, status: true, catalogItem: { select: { slug: true } } },
      });

      memberReqs.forEach((req) => {
        if (
          req.status !== EngagementRequestStatus.CANCELLED &&
          req.status !== EngagementRequestStatus.REJECTED
        ) {
          usedToolIds.add(req.catalogItemId);
        }
        if (
          req.catalogItem.slug === 'trainer-accreditation' &&
          req.status === EngagementRequestStatus.FULFILLED
        ) {
          hasTrainerAccreditation = true;
        }
      });
    }

    const result = items.map((item) => {
      let state = 'available';
      let blockReason: string | undefined = undefined;

      if (item.pricingModel === 'NONE') {
        state = 'blocked';
        blockReason = 'not_requestable';
      } else if (item.pricingModel === 'IN_HUB') {
        state = 'in_hub';
      }

      if (memberId && state !== 'blocked' && state !== 'in_hub') {
        const itemReqs = memberReqs.filter((r) => r.catalogItemId === item.id);
        const hasOpenReq = itemReqs.some((r) =>
          (
            [
              EngagementRequestStatus.SUBMITTED,
              EngagementRequestStatus.UNDER_REVIEW,
              EngagementRequestStatus.AWAITING_RESPONSE,
              EngagementRequestStatus.AWAITING_PAYMENT,
              EngagementRequestStatus.PAYMENT_CONFIRMED,
            ] as EngagementRequestStatus[]
          ).includes(r.status),
        );

        const hasActiveReq = itemReqs.some((r) => r.status === EngagementRequestStatus.FULFILLED);

        if (hasOpenReq) {
          state = 'open_request';
        } else if (item.slug === 'content-accreditation' && !hasTrainerAccreditation) {
          state = 'blocked';
          blockReason = 'requires_trainer_accreditation';
        } else if (hasActiveReq) {
          if (item.slug === 'trainer-accreditation') {
            state = 'blocked';
            blockReason = 'already_held';
          } else {
            state = 'active'; // Does NOT block new requests for tools/games/services
          }
        }
      }

      const basePrice = Number(item.basePrice);

      const isEntitlementEligible =
        isMasterActive &&
        isEligibleForMasterQuarterlyEntitlement({
          category: item.category,
          pricingModel: item.pricingModel,
          isActive: true,
        });
      const isFirstAssessmentUse =
        isAuthenticated && memberStatus === MembershipStatus.ACTIVE
          ? !usedToolIds.has(item.id)
          : false;

      const pricing = isAuthenticated
        ? calculateItemPricing({
            basePrice,
            category: item.category,
            pricingModel: item.pricingModel,
            tier: memberTier,
            membershipStatus: memberStatus,
            isQuarterlyEntitlementEligible: isEntitlementEligible,
            isFirstAssessmentUse,
          })
        : {
            basePrice,
            discountPercentage: 0,
            discountAmount: 0,
            finalPrice: basePrice,
            currency: 'USD',
            isQuarterlyEntitlementApplied: false,
            isFirstUseFreeApplied: false,
            isIncludedWithPlan: false,
            ruleCitation: 'Public pricing',
          };

      return {
        ...item,
        basePrice: Number(item.basePrice),
        percentageRate: item.percentageRate ? Number(item.percentageRate) : null,
        memberState: state,
        memberStateReason: blockReason,
        memberPricing: pricing,
      };
    });

    return result;
  }
}
