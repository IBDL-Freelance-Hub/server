import { PrismaClient, EngagementRequestStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError, ValidationError } from '../../../shared/errors';
import { assertValidRequestTransition } from '../domain/request-state-machine';
import {
  IRequestNotificationService,
  requestNotificationService as defaultNotificationService,
} from './services/request-notification.service';
import { AdminActorContext } from './admin-start-review.usecase';

export interface AdminRequestInfoInput {
  reviewNotes: string;
}

export interface AdminRequestInfoResult {
  id: string;
  referenceCode: string;
  status: EngagementRequestStatus;
  reviewNotes: string;
  infoRequestedAt: string;
  message: string;
}

export class AdminRequestInfoUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly notificationSvc: IRequestNotificationService = defaultNotificationService,
  ) {}

  async execute(
    identifier: string,
    input: AdminRequestInfoInput,
    actor: AdminActorContext,
  ): Promise<AdminRequestInfoResult> {
    const trimmedNotes = input.reviewNotes?.trim();
    if (!trimmedNotes || trimmedNotes.length < 5) {
      throw new ValidationError('reviewNotes is mandatory and must contain at least 5 characters.');
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

    assertValidRequestTransition(request.status, EngagementRequestStatus.AWAITING_RESPONSE);

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.engagementRequest.update({
        where: { id: request.id },
        data: {
          status: EngagementRequestStatus.AWAITING_RESPONSE,
          reviewNotes: trimmedNotes,
          infoRequestedAt: now,
        },
      });

      // 1. Immutable Staff AuditLog (SEC-33)
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          actorRole: actor.staffRole,
          action: 'ADMIN_REQUEST_INFO_REQUESTED',
          resource: 'EngagementRequest',
          resourceId: request.id,
          reason: trimmedNotes,
          ipAddress: actor.ipAddress,
          requestId: actor.requestId,
          previousState: { status: request.status },
          newState: {
            status: EngagementRequestStatus.AWAITING_RESPONSE,
            reviewNotes: trimmedNotes,
            infoRequestedAt: now,
          },
        },
      });

      // 2. Member Activity Feed Timeline Entry (ACT-58)
      await tx.auditLog.create({
        data: {
          actorId: request.member.userId,
          actorRole: 'MEMBER',
          action: 'REQUEST_INFO_REQUESTED',
          resource: 'EngagementRequest',
          resourceId: request.id,
          reason: trimmedNotes,
          previousState: { status: request.status },
          newState: { status: EngagementRequestStatus.AWAITING_RESPONSE },
        },
      });

      return rec;
    });

    // 3. Dispatch Member Notification
    await this.notificationSvc.dispatchNotification({
      userId: request.member.userId,
      memberEmail: request.member.user.email,
      referenceCode: request.referenceCode,
      type: 'REQUEST_INFO_REQUESTED',
      titleEn: 'Information Requested on Your Request',
      titleAr: 'مطلوب معلومات إضافية بخصوص طلبك',
      messageEn: `Our review team has requested additional information regarding request (${request.referenceCode}): "${trimmedNotes}". Please review and provide the details.`,
      messageAr: `طلب فريق المراجعة معلومات إضافية بخصوص طلبك (${request.referenceCode}): "${trimmedNotes}". يرجى المراجعة وتزويدنا بالتفاصيل المطلوبة.`,
      metadata: { requestId: request.id, reviewNotes: trimmedNotes },
    });

    return {
      id: updated.id,
      referenceCode: updated.referenceCode,
      status: updated.status,
      reviewNotes: updated.reviewNotes!,
      infoRequestedAt: updated.infoRequestedAt!.toISOString(),
      message: 'Information requested from member successfully.',
    };
  }
}
