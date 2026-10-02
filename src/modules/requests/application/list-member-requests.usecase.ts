import {
  PrismaClient,
  EngagementRequestStatus,
  CatalogItemCategory,
  Prisma,
  PricingModel,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { AuthenticationError } from '../../../shared/errors';

export interface ListMemberRequestsQuery {
  status?: EngagementRequestStatus;
  category?: CatalogItemCategory;
  page?: number;
  limit?: number;
}

export interface MemberRequestSummaryDTO {
  id: string;
  referenceCode: string;
  category: CatalogItemCategory;
  pricingModel: PricingModel;
  itemName: string;
  itemSlug: string;
  status: EngagementRequestStatus;
  isQuotePending: boolean;
  quoteStatus: 'PENDING_APPROVAL' | 'CONFIRMED';
  finalPrice: number | null;
  currency: string;
  isFirstUseFreeApplied: boolean;
  isQuarterlyEntitlementApplied: boolean;
  quarterIndex: number | null;
  membershipYear: number | null;
  timestamps: {
    createdAt: string;
    infoRequestedAt: string | null;
    approvedAt: string | null;
    paidAt: string | null;
    fulfilledAt: string | null;
    cancelledAt: string | null;
    rejectedAt: string | null;
    updatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedMemberRequestsResult {
  requests: MemberRequestSummaryDTO[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class ListMemberRequestsUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(
    userId: string,
    query: ListMemberRequestsQuery,
  ): Promise<PaginatedMemberRequestsResult> {
    // 1. Strict Tenant Isolation: Find member by userId
    const member = await this.prisma.member.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!member) {
      throw new AuthenticationError('Member profile not found.');
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.EngagementRequestWhereInput = {
      memberId: member.id, // Strictly scoped to authenticated member
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.category) {
      where.category = query.category;
    }

    // 2. Fetch total count and paginated items (MEM-78f: Never silently disappear)
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
          finalPrice: true,
          currency: true,
          isQuarterlyEntitlement: true,
          quarterIndex: true,
          membershipYear: true,
          createdAt: true,
          infoRequestedAt: true,
          approvedAt: true,
          paidAt: true,
          fulfilledAt: true,
          cancelledAt: true,
          rejectedAt: true,
          updatedAt: true,
          catalogItem: {
            select: {
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

    const requests: MemberRequestSummaryDTO[] = records.map((req) => {
      const isQuotePending =
        (req.pricingModel === PricingModel.PERCENTAGE ||
          req.pricingModel === PricingModel.QUOTED) &&
        (req.status === EngagementRequestStatus.SUBMITTED ||
          req.status === EngagementRequestStatus.UNDER_REVIEW ||
          req.status === EngagementRequestStatus.AWAITING_RESPONSE);

      const isFirstUseFreeApplied =
        req.category === CatalogItemCategory.DIAGNOSTIC_TOOL &&
        req.pricingModel === PricingModel.FREE_THEN_PAID &&
        !req.isQuarterlyEntitlement &&
        Number(req.finalPrice ?? 0) === 0;

      return {
        id: req.id,
        referenceCode: req.referenceCode,
        category: req.category,
        pricingModel: req.pricingModel,
        itemName: req.catalogItem.nameEn,
        itemSlug: req.catalogItem.slug,
        status: req.status,
        isQuotePending,
        quoteStatus: isQuotePending ? 'PENDING_APPROVAL' : 'CONFIRMED',
        finalPrice: isQuotePending ? null : req.finalPrice !== null ? Number(req.finalPrice) : null,
        currency: req.currency,
        isFirstUseFreeApplied,
        isQuarterlyEntitlementApplied: req.isQuarterlyEntitlement,
        quarterIndex: req.quarterIndex,
        membershipYear: req.membershipYear,
        timestamps: {
          createdAt: req.createdAt.toISOString(),
          infoRequestedAt: req.infoRequestedAt?.toISOString() ?? null,
          approvedAt: req.approvedAt?.toISOString() ?? null,
          paidAt: req.paidAt?.toISOString() ?? null,
          fulfilledAt: req.fulfilledAt?.toISOString() ?? null,
          cancelledAt: req.cancelledAt?.toISOString() ?? null,
          rejectedAt: req.rejectedAt?.toISOString() ?? null,
          updatedAt: req.updatedAt.toISOString(),
        },
        createdAt: req.createdAt.toISOString(),
        updatedAt: req.updatedAt.toISOString(),
      };
    });

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
