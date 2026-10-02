import {
  PrismaClient,
  EngagementRequestStatus,
  CatalogItemCategory,
  Prisma,
  PricingModel,
  MembershipTier,
  MembershipStatus,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';

export interface AdminListRequestsQuery {
  status?: EngagementRequestStatus;
  category?: CatalogItemCategory;
  memberId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AdminRequestListItemDTO {
  id: string;
  referenceCode: string;
  category: CatalogItemCategory;
  pricingModel: PricingModel;
  status: EngagementRequestStatus;
  member: {
    id: string;
    fullNameEn: string;
    fullNameAr: string | null;
    email: string;
  };
  catalogItem: {
    id: string;
    nameEn: string;
    slug: string;
  };
  pricing: {
    tierAtRequest: MembershipTier;
    membershipStatusAtRequest: MembershipStatus;
    basePrice: number | null;
    discountAmount: number | null;
    finalPrice: number | null;
    currency: string;
    isQuarterlyEntitlement: boolean;
  };
  paymentReference: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedAdminRequestsResult {
  requests: AdminRequestListItemDTO[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class AdminListRequestsUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(query: AdminListRequestsQuery): Promise<PaginatedAdminRequestsResult> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.EngagementRequestWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.memberId) {
      where.memberId = query.memberId;
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { referenceCode: { contains: search, mode: 'insensitive' } },
        { member: { fullNameEn: { contains: search, mode: 'insensitive' } } },
        { member: { user: { email: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.engagementRequest.count({ where }),
      this.prisma.engagementRequest.findMany({
        where,
        select: {
          id: true,
          referenceCode: true,
          category: true,
          pricingModel: true,
          status: true,
          tierAtRequest: true,
          membershipStatusAtRequest: true,
          basePrice: true,
          discountAmount: true,
          finalPrice: true,
          currency: true,
          isQuarterlyEntitlement: true,
          paymentReference: true,
          paidAt: true,
          createdAt: true,
          updatedAt: true,
          member: {
            select: {
              id: true,
              fullNameEn: true,
              fullNameAr: true,
              user: { select: { email: true } },
            },
          },
          catalogItem: {
            select: {
              id: true,
              nameEn: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const requests: AdminRequestListItemDTO[] = records.map((req) => ({
      id: req.id,
      referenceCode: req.referenceCode,
      category: req.category,
      pricingModel: req.pricingModel,
      status: req.status,
      member: {
        id: req.member.id,
        fullNameEn: req.member.fullNameEn,
        fullNameAr: req.member.fullNameAr,
        email: req.member.user.email,
      },
      catalogItem: {
        id: req.catalogItem.id,
        nameEn: req.catalogItem.nameEn,
        slug: req.catalogItem.slug,
      },
      pricing: {
        tierAtRequest: req.tierAtRequest,
        membershipStatusAtRequest: req.membershipStatusAtRequest,
        basePrice: req.basePrice !== null ? Number(req.basePrice) : null,
        discountAmount: req.discountAmount !== null ? Number(req.discountAmount) : null,
        finalPrice: req.finalPrice !== null ? Number(req.finalPrice) : null,
        currency: req.currency,
        isQuarterlyEntitlement: req.isQuarterlyEntitlement,
      },
      paymentReference: req.paymentReference,
      paidAt: req.paidAt?.toISOString() ?? null,
      createdAt: req.createdAt.toISOString(),
      updatedAt: req.updatedAt.toISOString(),
    }));

    return {
      requests,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }
}
