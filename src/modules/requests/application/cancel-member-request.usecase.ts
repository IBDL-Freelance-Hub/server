import { PrismaClient, EngagementRequestStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError, BusinessRuleError } from '../../../shared/errors';
import { canMemberCancelRequest } from '../domain/request-state-machine';
import {
  IRequestNotificationService,
  requestNotificationService as defaultNotificationService,
} from './services/request-notification.service';

export interface CancelMemberRequestInput {
  reason?: string;
}

export interface CancelMemberRequestResult {
  id: string;
  referenceCode: string;
  status: EngagementRequestStatus;
  cancellationReason: string | null;
  cancelledAt: string;
  message: string;
}

export class CancelMemberRequestUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly notificationSvc: IRequestNotificationService = defaultNotificationService,
  ) {}

  async execute(
    userId: string,
    identifier: string,
    input: CancelMemberRequestInput,
    meta?: { ipAddress?: string; requestId?: string },
  ): Promise<CancelMemberRequestResult> {
    const request = await this.prisma.engagementRequest.findFirst({
      where: {
        OR: [{ id: identifier }, { referenceCode: identifier }],
      },
      include: {
        member: {
          select: {
            id: true,
            userId: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    if (!request || request.member.userId !== userId) {
      throw new NotFoundError(`Engagement request '${identifier}' not found.`);
    }

    // Enforce domain rule: canMemberCancelRequest
    if (!canMemberCancelRequest(request.status)) {
      throw new BusinessRuleError(
        `Cannot cancel request in '${request.status}' status. Cancellation is only permitted while request is SUBMITTED, UNDER_REVIEW, AWAITING_RESPONSE, or AWAITING_PAYMENT.`,
      );
    }

    const cancelledAt = new Date();
    const cancellationReason = input.reason?.trim() || 'Cancelled by member.';

    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.engagementRequest.update({
        where: { id: request.id },
        data: {
          status: EngagementRequestStatus.CANCELLED,
          cancelledAt,
          cancellationReason,
        },
      });

      // 1. Structured immutable audit log for member self-cancellation (SEC-33)
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: 'MEMBER',
          action: 'CANCEL_ENGAGEMENT_REQUEST',
          resource: 'EngagementRequest',
          resourceId: request.id,
          ipAddress: meta?.ipAddress,
          requestId: meta?.requestId,
          reason: cancellationReason,
          previousState: { status: request.status },
          newState: {
            status: EngagementRequestStatus.CANCELLED,
            cancellationReason,
            cancelledAt: cancelledAt.toISOString(),
          },
        },
      });

      // 2. Member Activity Feed Timeline Entry (ACT-58, mapped in activity-mapper.ts)
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: 'MEMBER',
          action: 'REQUEST_CANCELLED',
          resource: 'EngagementRequest',
          resourceId: request.id,
          reason: cancellationReason,
          previousState: { status: request.status },
          newState: {
            status: EngagementRequestStatus.CANCELLED,
          },
        },
      });

      return rec;
    });

    // 3. Dispatch member notification
    await this.notificationSvc.dispatchNotification({
      userId,
      memberEmail: request.member.user?.email,
      referenceCode: request.referenceCode,
      type: 'REQUEST_CANCELLED',
      titleEn: 'Request Cancelled',
      titleAr: 'تم إلغاء الطلب',
      messageEn: `Your request (${request.referenceCode}) has been cancelled.`,
      messageAr: `تم إلغاء طلبك (${request.referenceCode}) بنجاح.`,
      metadata: { requestId: request.id, status: EngagementRequestStatus.CANCELLED },
    });

    return {
      id: updated.id,
      referenceCode: updated.referenceCode,
      status: updated.status,
      cancellationReason: updated.cancellationReason,
      cancelledAt: updated.cancelledAt!.toISOString(),
      message: 'Engagement request cancelled successfully.',
    };
  }
}
