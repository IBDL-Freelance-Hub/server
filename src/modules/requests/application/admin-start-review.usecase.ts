import { PrismaClient, EngagementRequestStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError } from '../../../shared/errors';
import { assertValidRequestTransition } from '../domain/request-state-machine';
import {
  IRequestNotificationService,
  requestNotificationService as defaultNotificationService,
} from './services/request-notification.service';

export interface AdminActorContext {
  userId: string;
  staffRole: string;
  ipAddress?: string;
  requestId?: string;
}

export interface AdminStartReviewResult {
  id: string;
  referenceCode: string;
  status: EngagementRequestStatus;
  message: string;
  updatedAt: string;
}

export class AdminStartReviewUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly notificationSvc: IRequestNotificationService = defaultNotificationService,
  ) {}

  async execute(identifier: string, actor: AdminActorContext): Promise<AdminStartReviewResult> {
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
        catalogItem: { select: { nameEn: true, nameAr: true } },
      },
    });

    if (!request) {
      throw new NotFoundError(`Engagement request '${identifier}' not found.`);
    }

    assertValidRequestTransition(request.status, EngagementRequestStatus.UNDER_REVIEW);

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.engagementRequest.update({
        where: { id: request.id },
        data: {
          status: EngagementRequestStatus.UNDER_REVIEW,
        },
      });

      // 1. Immutable AuditLog for Staff Action (SEC-33)
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          actorRole: actor.staffRole,
          action: 'ADMIN_REQUEST_REVIEW_STARTED',
          resource: 'EngagementRequest',
          resourceId: request.id,
          ipAddress: actor.ipAddress,
          requestId: actor.requestId,
          previousState: { status: request.status },
          newState: { status: EngagementRequestStatus.UNDER_REVIEW },
        },
      });

      // 2. Member Activity Feed Timeline Entry (ACT-58)
      await tx.auditLog.create({
        data: {
          actorId: request.member.userId,
          actorRole: 'MEMBER',
          action: 'REQUEST_UNDER_REVIEW',
          resource: 'EngagementRequest',
          resourceId: request.id,
          previousState: { status: request.status },
          newState: { status: EngagementRequestStatus.UNDER_REVIEW },
        },
      });

      return rec;
    });

    // 3. Dispatch Member Notification
    await this.notificationSvc.dispatchNotification({
      userId: request.member.userId,
      memberEmail: request.member.user.email,
      referenceCode: request.referenceCode,
      type: 'REQUEST_UNDER_REVIEW',
      titleEn: 'Request Under Review',
      titleAr: 'الطلب قيد المراجعة',
      messageEn: `Your request (${request.referenceCode}) is now under review by our operations team.`,
      messageAr: `طلبك برقم (${request.referenceCode}) قيد المراجعة حالياً من قبل فريق العمليات.`,
      metadata: { requestId: request.id, status: EngagementRequestStatus.UNDER_REVIEW },
    });

    return {
      id: updated.id,
      referenceCode: updated.referenceCode,
      status: updated.status,
      message: 'Request is now under review.',
      updatedAt: now.toISOString(),
    };
  }
}
