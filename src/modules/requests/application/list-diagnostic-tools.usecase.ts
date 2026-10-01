import {
  PrismaClient,
  CatalogItemCategory,
  MembershipTier,
  MembershipStatus,
  EngagementRequestStatus,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { calculateItemPricing } from '../domain/pricing-calculator';
import { getContractualQuarter } from '../domain/quarterly-entitlement';

export interface DiagnosticToolDTO {
  id: string;
  slug: string;
  category: CatalogItemCategory;
  nameEn: string;
  nameAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  basePrice: number;
  discountPercentage: number;
  discountAmount: number;
  finalPrice: number;
  currency: string;
  quarterlyEntitlementStatus: 'AVAILABLE' | 'USED' | 'INELIGIBLE';
  isFirstUseFree?: boolean;
  quarterInfo?: {
    quarterIndex: number;
    membershipYear: number;
    quarterStart: string;
    quarterEnd: string;
  };
  metadata: unknown;
  pricingCitation: string;
}

export class ListDiagnosticToolsUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(userId?: string): Promise<DiagnosticToolDTO[]> {
    // 1. Fetch diagnostic assessment instruments
    const tools = await this.prisma.catalogItem.findMany({
      where: {
        category: CatalogItemCategory.DIAGNOSTIC_TOOL,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    let tier: MembershipTier = MembershipTier.ESSENTIAL;
    let status: MembershipStatus = MembershipStatus.ACTIVE;
    let isAuthenticated = false;
    let isMasterActive = false;
    let isEntitlementAvailable = false;
    let quarterData: ReturnType<typeof getContractualQuarter> | undefined;
    const usedToolIds = new Set<string>();

    if (userId) {
      const member = await this.prisma.member.findUnique({
        where: { userId },
        include: {
          memberships: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      const currentMembership = member?.memberships[0];
      if (member && currentMembership) {
        isAuthenticated = true;
        tier = currentMembership.tier;
        status = currentMembership.status;

        // Fetch diagnostic tool IDs that this member has already requested (excluding CANCELLED and REJECTED)
        const previousToolRequests = await this.prisma.engagementRequest.findMany({
          where: {
            memberId: member.id,
            category: CatalogItemCategory.DIAGNOSTIC_TOOL,
            status: {
              notIn: [EngagementRequestStatus.CANCELLED, EngagementRequestStatus.REJECTED],
            },
          },
          select: { catalogItemId: true },
        });
        for (const req of previousToolRequests) {
          usedToolIds.add(req.catalogItemId);
        }

        if (tier === MembershipTier.MASTER && status === MembershipStatus.ACTIVE) {
          isMasterActive = true;
          quarterData = getContractualQuarter(currentMembership.startDate, new Date());

          // Count active/valid entitlement requests in current contractual quarter (MEM-76)
          const usedCount = await this.prisma.engagementRequest.count({
            where: {
              memberId: member.id,
              isQuarterlyEntitlement: true,
              quarterIndex: quarterData.quarterIndex,
              membershipYear: quarterData.membershipYear,
              status: {
                notIn: [EngagementRequestStatus.CANCELLED, EngagementRequestStatus.REJECTED],
              },
            },
          });

          isEntitlementAvailable = usedCount === 0;
        }
      }
    }

    return tools.map((tool) => {
      const basePrice = Number(tool.basePrice);

      let entitlementStatus: 'AVAILABLE' | 'USED' | 'INELIGIBLE' = 'INELIGIBLE';
      if (isMasterActive) {
        entitlementStatus = isEntitlementAvailable ? 'AVAILABLE' : 'USED';
      }

      const isFirstAssessmentUse =
        isAuthenticated && status === MembershipStatus.ACTIVE ? !usedToolIds.has(tool.id) : false;

      const pricing = isAuthenticated
        ? calculateItemPricing({
            basePrice,
            category: CatalogItemCategory.DIAGNOSTIC_TOOL,
            pricingModel: tool.pricingModel,
            tier,
            membershipStatus: status,
            isQuarterlyEntitlementEligible: isEntitlementAvailable,
            isFirstAssessmentUse,
          })
        : {
            basePrice,
            discountPercentage: 0,
            discountAmount: 0,
            finalPrice: basePrice,
            currency: 'USD' as const,
            isQuarterlyEntitlementApplied: false,
            isFirstUseFreeApplied: false,
            isIncludedWithPlan: false,
            ruleCitation: 'Public standard non-member catalog pricing.',
          };

      return {
        id: tool.id,
        slug: tool.slug,
        category: tool.category,
        nameEn: tool.nameEn,
        nameAr: tool.nameAr,
        descriptionEn: tool.descriptionEn,
        descriptionAr: tool.descriptionAr,
        basePrice: pricing.basePrice,
        discountPercentage: pricing.discountPercentage,
        discountAmount: pricing.discountAmount,
        finalPrice: pricing.finalPrice,
        currency: pricing.currency,
        quarterlyEntitlementStatus: entitlementStatus,
        isFirstUseFree: pricing.isFirstUseFreeApplied,
        quarterInfo: quarterData
          ? {
              quarterIndex: quarterData.quarterIndex,
              membershipYear: quarterData.membershipYear,
              quarterStart: quarterData.quarterStart.toISOString(),
              quarterEnd: quarterData.quarterEnd.toISOString(),
            }
          : undefined,
        metadata: tool.metadata,
        pricingCitation: pricing.ruleCitation,
      };
    });
  }
}
