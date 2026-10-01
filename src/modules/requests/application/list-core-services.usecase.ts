import {
  PrismaClient,
  CatalogItemCategory,
  MembershipTier,
  MembershipStatus,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { calculateItemPricing } from '../domain/pricing-calculator';

export interface CoreServiceItemDTO {
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
  isIncludedWithPlan: boolean;
  metadata: unknown;
  pricingCitation: string;
}

export class ListCoreServicesUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(userId?: string): Promise<CoreServiceItemDTO[]> {
    // 1. Fetch all active Core Hub Services from catalog
    const services = await this.prisma.catalogItem.findMany({
      where: {
        category: CatalogItemCategory.CORE_SERVICE,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2. Fetch authenticated member's active or current membership status (SEC-33)
    let tier: MembershipTier = MembershipTier.ESSENTIAL;
    let status: MembershipStatus = MembershipStatus.ACTIVE;
    let isAuthenticatedMember = false;

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

      const latestMembership = member?.memberships[0];
      if (latestMembership) {
        tier = latestMembership.tier;
        status = latestMembership.status;
        isAuthenticatedMember = true;
      }
    }

    // 3. Map services with authoritative server-side pricing
    return services.map((service) => {
      const basePrice = Number(service.basePrice);

      const pricing = isAuthenticatedMember
        ? calculateItemPricing({
            basePrice,
            category: CatalogItemCategory.CORE_SERVICE,
            tier,
            membershipStatus: status,
          })
        : {
            basePrice,
            discountPercentage: 0,
            discountAmount: 0,
            finalPrice: basePrice,
            currency: 'USD' as const,
            isQuarterlyEntitlementApplied: false,
            isIncludedWithPlan: false,
            ruleCitation: 'Public standard non-member catalog pricing.',
          };

      return {
        id: service.id,
        slug: service.slug,
        category: service.category,
        nameEn: service.nameEn,
        nameAr: service.nameAr,
        descriptionEn: service.descriptionEn,
        descriptionAr: service.descriptionAr,
        basePrice: pricing.basePrice,
        discountPercentage: pricing.discountPercentage,
        discountAmount: pricing.discountAmount,
        finalPrice: pricing.finalPrice,
        currency: pricing.currency,
        isIncludedWithPlan: pricing.isIncludedWithPlan,
        metadata: service.metadata,
        pricingCitation: pricing.ruleCitation,
      };
    });
  }
}
