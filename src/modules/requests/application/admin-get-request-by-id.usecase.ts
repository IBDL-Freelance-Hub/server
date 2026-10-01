import {
  PrismaClient,
  EngagementRequestStatus,
  CatalogItemCategory,
  PricingModel,
  MembershipTier,
  MembershipStatus,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError } from '../../../shared/errors';

export interface AdminRequestDetailDTO {
  id: string;
  referenceCode: string;
  category: CatalogItemCategory;
  pricingModel: PricingModel;
  status: EngagementRequestStatus;
  member: {
    id: string;
    userId: string;
    fullNameEn: string;
    fullNameAr: string | null;
    email: string;
    phone: string;
    country: string;
  };
  catalogItem: {
    id: string;
    slug: string;
    nameEn: string;
    nameAr: string | null;
    category: CatalogItemCategory;
    pricingModel: PricingModel;
    basePrice: number;
    percentageRate: number | null;
  };
  pricing: {
    tierAtRequest: MembershipTier;
    membershipStatusAtRequest: MembershipStatus;
    baseAmount: number | null;
    basePrice: number | null;
    discountPercentage: number | null;
    discountAmount: number | null;
    finalPrice: number | null;
    currency: string;
    isQuarterlyEntitlement: boolean;
    quarterIndex: number | null;
    membershipYear: number | null;
  };
  brief: unknown;
  customRequirements: string | null;
  intakeData: unknown;
  adminNotes: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  infoRequestedAt: string | null;
  approvedAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedCredential?: {
    id: string;
    username: string;
    accessUrl: string | null;
    assignedAt: string | null;
  } | null;
}

export class AdminGetRequestByIdUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(identifier: string): Promise<AdminRequestDetailDTO> {
    const request = await this.prisma.engagementRequest.findFirst({
      where: {
        OR: [{ id: identifier }, { referenceCode: identifier }],
      },
      include: {
        member: {
          select: {
            id: true,
            userId: true,
            fullNameEn: true,
            fullNameAr: true,
            phone: true,
            country: true,
            user: { select: { email: true } },
          },
        },
        catalogItem: true,
      },
    });

    if (!request) {
      throw new NotFoundError(`Engagement request '${identifier}' not found.`);
    }

    // Check for assigned credential in pool if diagnostic tool
    let assignedCredential: AdminRequestDetailDTO['assignedCredential'] = null;
    if (request.category === CatalogItemCategory.DIAGNOSTIC_TOOL) {
      const cred = await this.prisma.assessmentCredentialPool.findFirst({
        where: { assignedTo: request.memberId },
        orderBy: { assignedAt: 'desc' },
      });
      if (cred) {
        assignedCredential = {
          id: cred.id,
          username: cred.username,
          accessUrl: cred.accessUrl,
          assignedAt: cred.assignedAt?.toISOString() ?? null,
        };
      }
    }

    return {
      id: request.id,
      referenceCode: request.referenceCode,
      category: request.category,
      pricingModel: request.pricingModel,
      status: request.status,
      member: {
        id: request.member.id,
        userId: request.member.userId,
        fullNameEn: request.member.fullNameEn,
        fullNameAr: request.member.fullNameAr,
        email: request.member.user.email,
        phone: request.member.phone,
        country: request.member.country,
      },
      catalogItem: {
        id: request.catalogItem.id,
        slug: request.catalogItem.slug,
        nameEn: request.catalogItem.nameEn,
        nameAr: request.catalogItem.nameAr,
        category: request.catalogItem.category,
        pricingModel: request.catalogItem.pricingModel,
        basePrice: Number(request.catalogItem.basePrice),
        percentageRate: request.catalogItem.percentageRate
          ? Number(request.catalogItem.percentageRate)
          : null,
      },
      pricing: {
        tierAtRequest: request.tierAtRequest,
        membershipStatusAtRequest: request.membershipStatusAtRequest,
        baseAmount: request.baseAmount,
        basePrice: request.basePrice !== null ? Number(request.basePrice) : null,
        discountPercentage:
          request.discountPercentage !== null ? Number(request.discountPercentage) : null,
        discountAmount: request.discountAmount !== null ? Number(request.discountAmount) : null,
        finalPrice: request.finalPrice !== null ? Number(request.finalPrice) : null,
        currency: request.currency,
        isQuarterlyEntitlement: request.isQuarterlyEntitlement,
        quarterIndex: request.quarterIndex,
        membershipYear: request.membershipYear,
      },
      brief: request.brief,
      customRequirements: request.customRequirements,
      intakeData: request.intakeData,
      adminNotes: request.adminNotes,
      reviewNotes: request.reviewNotes,
      rejectionReason: request.rejectionReason,
      cancellationReason: request.cancellationReason,
      paymentReference: request.paymentReference,
      paidAt: request.paidAt?.toISOString() ?? null,
      infoRequestedAt: request.infoRequestedAt?.toISOString() ?? null,
      approvedAt: request.approvedAt?.toISOString() ?? null,
      fulfilledAt: request.fulfilledAt?.toISOString() ?? null,
      cancelledAt: request.cancelledAt?.toISOString() ?? null,
      rejectedAt: request.rejectedAt?.toISOString() ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      assignedCredential,
    };
  }
}
