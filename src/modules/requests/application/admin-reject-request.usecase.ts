import { PrismaClient, EngagementRequestStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError, ValidationError } from '../../../shared/errors';
import { assertValidRequestTransition } from '../domain/request-state-machine';
import {
  IRequestNotificationService,
  requestNotificationService as defaultNotificationService,
} from './services/request-notification.service';
import { AdminActorContext } from './admin-start-review.usecase';

export interface AdminRejectRequestInput {
  rejectionReason: string;
}

export interface AdminRejectRequestResult {
  id: string;
  referenceCode: string;
  status: EngagementRequestStatus;
  rejectionReason: string;
  rejectedAt: string;
  message: string;
}

export class AdminRejectRequestUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly notificationSvc: IRequestNotificationService = defaultNotificationService,
  ) {}

  async execute(
    identifier: string,
    input: AdminRejectRequestInput,
    actor: AdminActorContext,
  ): Promise<AdminRejectRequestResult> {
    const trimmedReason = input.rejectionReason?.trim();
    if (!trimmedReason || trimmedReason.length < 5) {
      throw new ValidationError(
        'rejectionReason is mandatory and must contain at least 5 characters.',
      );
    }

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
      },
    });

    if (!request) {
      throw new NotFoundError(`Engagement request '${identifier}' not found.`);
    }

    assertValidRequestTransition(request.status, EngagementRequestStatus.REJECTED);

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.engagementRequest.update({
        where: { id: request.id },
        data: {
          status: EngagementRequestStatus.REJECTED,
          rejectionReason: trimmedReason,
          rejectedAt: now,
        },
      });

      // 1. Immutable Staff AuditLog (SEC-33)
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          actorRole: actor.staffRole,
          action: 'ADMIN_REQUEST_REJECTED',
          resource: 'EngagementRequest',
          resourceId: request.id,
          reason: trimmedReason,
          ipAddress: actor.ipAddress,
          requestId: actor.requestId,
          previousState: { status: request.status },
          newState: {
            status: EngagementRequestStatus.REJECTED,
            rejectionReason: trimmedReason,
            rejectedAt: now,
          },
        },
      });

      // 2. Member Activity Feed Timeline Entry (ACT-58)
      await tx.auditLog.create({
        data: {
          actorId: request.member.userId,
          actorRole: 'MEMBER',
          action: 'REQUEST_REJECTED',
          resource: 'EngagementRequest',
          resourceId: request.id,
          reason: trimmedReason,
          previousState: { status: request.status },
          newState: { status: EngagementRequestStatus.REJECTED },
        },
      });

      return rec;
    });

    // 3. Dispatch Member Notification
    await this.notificationSvc.dispatchNotification({
      userId: request.member.userId,
      memberEmail: request.member.user.email,
      referenceCode: request.referenceCode,
      type: 'REQUEST_REJECTED',
      titleEn: 'Request Rejected',
      titleAr: 'تم رفض الطلب',
      messageEn: `Your request (${request.referenceCode}) has been declined. Reason: "${trimmedReason}".`,
      messageAr: `تم رفض طلبك (${request.referenceCode}). السبب: "${trimmedReason}".`,
      metadata: { requestId: request.id, rejectionReason: trimmedReason },
    });

    return {
      id: updated.id,
      referenceCode: updated.referenceCode,
      status: updated.status,
      rejectionReason: updated.rejectionReason!,
      rejectedAt: updated.rejectedAt!.toISOString(),
      message: 'Request rejected successfully.',
    };
  }
}
