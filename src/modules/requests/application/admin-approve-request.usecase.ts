import { PrismaClient, EngagementRequestStatus, PricingModel } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError } from '../../../shared/errors';
import { assertValidRequestTransition } from '../domain/request-state-machine';
import { calculateApprovedPrice, PricingCalculationResult } from '../domain/pricing-calculator';
import {
  IRequestNotificationService,
  requestNotificationService as defaultNotificationService,
} from './services/request-notification.service';
import { AdminActorContext } from './admin-start-review.usecase';

export interface AdminApproveRequestInput {
  baseAmount?: number;
  adminNotes?: string;
}

export interface AdminApproveRequestResult {
  id: string;
  referenceCode: string;
  status: EngagementRequestStatus;
  pricing: PricingCalculationResult;
  approvedAt: string;
  message: string;
}

export class AdminApproveRequestUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly notificationSvc: IRequestNotificationService = defaultNotificationService,
  ) {}

  async execute(
    identifier: string,
    input: AdminApproveRequestInput,
    actor: AdminActorContext,
  ): Promise<AdminApproveRequestResult> {
    const request = await this.prisma.engagementRequest.findFirst({
      where: {
        OR: [{ id: identifier }, { referenceCode: identifier }],
      },
      include: {
        member: {
          include: {
            user: { select: { id: true, email: true } },
          },
        },
        catalogItem: true,
      },
    });

    if (!request) {
      throw new NotFoundError(`Engagement request '${identifier}' not found.`);
    }

    // Determine effective baseAmount for calculation
    let effectiveBaseAmount = input.baseAmount ?? request.baseAmount ?? null;
    if (effectiveBaseAmount === null && request.pricingModel === PricingModel.PERCENTAGE) {
      const briefVal = (request.brief as Record<string, unknown> | null)?.['project_value'];
      if (briefVal !== undefined && briefVal !== null) {
        effectiveBaseAmount = Number(briefVal);
      }
    }

    const pricing = calculateApprovedPrice({
      pricingModel: request.pricingModel,
      standardPrice:
        request.standardPrice ?? request.basePrice ?? Number(request.catalogItem.basePrice),
      baseAmount: effectiveBaseAmount,
      percentageRate: request.percentageRate
        ? Number(request.percentageRate)
        : request.catalogItem.percentageRate
          ? Number(request.catalogItem.percentageRate)
          : 5.0,
      tier: request.tierAtRequest,
      membershipStatus: request.membershipStatusAtRequest,
      category: request.category,
      isQuarterlyEntitlementEligible: request.isQuarterlyEntitlement,
      isFirstAssessmentUse: false,
      isActive: true,
    });

    const targetStatus =
      pricing.finalPrice === 0
        ? EngagementRequestStatus.PAYMENT_CONFIRMED
        : EngagementRequestStatus.AWAITING_PAYMENT;

    assertValidRequestTransition(request.status, targetStatus);

    const now = new Date();
    const adminNotesCombined = input.adminNotes?.trim()
      ? request.adminNotes
        ? `${request.adminNotes}\n${input.adminNotes.trim()}`
        : input.adminNotes.trim()
      : request.adminNotes;

    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.engagementRequest.update({
        where: { id: request.id },
        data: {
          status: targetStatus,
          baseAmount: effectiveBaseAmount ?? pricing.basePrice,
          basePrice: pricing.basePrice,
          discountPercentage: pricing.discountPercentage,
          discountAmount: pricing.discountAmount,
          finalPrice: pricing.finalPrice,
          currency: pricing.currency,
          adminNotes: adminNotesCombined,
          approvedAt: now,
          paidAt: targetStatus === EngagementRequestStatus.PAYMENT_CONFIRMED ? now : request.paidAt,
        },
      });

      // 1. Immutable Staff AuditLog (SEC-33)
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          actorRole: actor.staffRole,
          action: 'ADMIN_REQUEST_APPROVED',
          resource: 'EngagementRequest',
          resourceId: request.id,
          reason: input.adminNotes?.trim() || null,
          ipAddress: actor.ipAddress,
          requestId: actor.requestId,
          previousState: { status: request.status, finalPrice: request.finalPrice },
          newState: {
            status: targetStatus,
            basePrice: pricing.basePrice,
            discountPercentage: pricing.discountPercentage,
            discountAmount: pricing.discountAmount,
            finalPrice: pricing.finalPrice,
            approvedAt: now,
          },
        },
      });

      // 2. Member Activity Feed Timeline Entry (ACT-58)
      await tx.auditLog.create({
        data: {
          actorId: request.member.userId,
          actorRole: 'MEMBER',
          action: 'REQUEST_APPROVED',
          resource: 'EngagementRequest',
          resourceId: request.id,
          reason: input.adminNotes?.trim() || null,
          previousState: { status: request.status },
          newState: { status: targetStatus, finalPrice: pricing.finalPrice },
        },
      });

      return rec;
    });

    // 3. Dispatch Member Notification
    const formattedPrice = (pricing.finalPrice / 100).toFixed(2);
    if (targetStatus === EngagementRequestStatus.PAYMENT_CONFIRMED) {
      await this.notificationSvc.dispatchNotification({
        userId: request.member.userId,
        memberEmail: request.member.user.email,
        referenceCode: request.referenceCode,
        type: 'REQUEST_APPROVED',
        titleEn: 'Request Approved (Fully Covered)',
        titleAr: 'تمت الموافقة على الطلب (مغطى بالكامل)',
        messageEn: `Your request (${request.referenceCode}) has been approved with 100% coverage ($0 payable). It is now awaiting fulfillment.`,
        messageAr: `تمت الموافقة على طلبك (${request.referenceCode}) بنسبة تغطية 100% (المبلغ المستحق: 0$). الطلب بانتظار التنفيذ.`,
        metadata: { requestId: request.id, finalPrice: 0, status: targetStatus },
      });
    } else {
      await this.notificationSvc.dispatchNotification({
        userId: request.member.userId,
        memberEmail: request.member.user.email,
        referenceCode: request.referenceCode,
        type: 'REQUEST_APPROVED',
        titleEn: 'Request Approved - Awaiting Payment',
        titleAr: 'تمت الموافقة على الطلب - بانتظار الدفع',
        messageEn: `Your request (${request.referenceCode}) has been approved. The payable amount is $${formattedPrice} ${pricing.currency}. Please proceed to payment.`,
        messageAr: `تمت الموافقة على طلبك (${request.referenceCode}). المبلغ المستحق للدفع هو $${formattedPrice} ${pricing.currency}. يرجى استكمال عملية الدفع.`,
        metadata: { requestId: request.id, finalPrice: pricing.finalPrice, status: targetStatus },
      });
    }

    return {
      id: updated.id,
      referenceCode: updated.referenceCode,
      status: updated.status,
      pricing,
      approvedAt: now.toISOString(),
      message:
        targetStatus === EngagementRequestStatus.PAYMENT_CONFIRMED
          ? 'Request approved and confirmed ($0 payable).'
          : 'Request approved and moved to awaiting payment.',
    };
  }
}
