import { PrismaClient, EngagementRequestStatus, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError, BusinessRuleError, ConflictError } from '../../../shared/errors';
import { assertValidRequestTransition } from '../domain/request-state-machine';
import {
  IRequestNotificationService,
  requestNotificationService as defaultNotificationService,
} from './services/request-notification.service';

export interface RespondInfoMemberRequestInput {
  responseNotes: string;
  updatedBrief?: Record<string, unknown>;
}

export interface RespondInfoMemberRequestResult {
  id: string;
  referenceCode: string;
  status: EngagementRequestStatus;
  message: string;
}

export class RespondInfoMemberRequestUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly notificationSvc: IRequestNotificationService = defaultNotificationService,
  ) {}

  async execute(
    userId: string,
    identifier: string,
    input: RespondInfoMemberRequestInput,
    meta?: { ipAddress?: string; requestId?: string },
  ): Promise<RespondInfoMemberRequestResult> {
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

    if (request.status !== EngagementRequestStatus.AWAITING_RESPONSE) {
      throw new BusinessRuleError(
        `Request is in '${request.status}' status. You can only respond with info when the status is AWAITING_RESPONSE.`,
      );
    }

    assertValidRequestTransition(request.status, EngagementRequestStatus.UNDER_REVIEW);

    // Merge existing brief with updatedBrief if provided
    let newBrief: Prisma.InputJsonValue | undefined =
      request.brief === null ? undefined : (request.brief as Prisma.InputJsonValue);
    if (input.updatedBrief && typeof input.updatedBrief === 'object') {
      const existingBrief =
        typeof request.brief === 'object' && request.brief !== null
          ? (request.brief as Record<string, unknown>)
          : {};
      newBrief = {
        ...existingBrief,
        ...input.updatedBrief,
      } as Prisma.InputJsonObject;
    }

    const newReviewNotes = request.reviewNotes
      ? `${request.reviewNotes}\n[Member Response]: ${input.responseNotes}`
      : `[Member Response]: ${input.responseNotes}`;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.engagementRequest.updateMany({
        where: { id: request.id, status: request.status },
        data: {
          status: EngagementRequestStatus.UNDER_REVIEW,
          brief: newBrief ?? undefined,
          reviewNotes: newReviewNotes,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictError(
          `Request status was updated concurrently. Expected '${request.status}' but it has changed. Please refresh and try again.`,
        );
      }

      // 1. Immutable Audit Log for Member Response
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: 'MEMBER',
          action: 'MEMBER_PROVIDED_INFO',
          resource: 'EngagementRequest',
          resourceId: request.id,
          ipAddress: meta?.ipAddress,
          requestId: meta?.requestId,
          reason: `Member responded to info request: ${input.responseNotes.substring(0, 50)}...`,
          previousState: { status: request.status, brief: request.brief },
          newState: {
            status: EngagementRequestStatus.UNDER_REVIEW,
            brief: newBrief,
          },
        },
      });

      // 2. Member Activity Feed Timeline Entry
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: 'MEMBER',
          action: 'REQUEST_INFO_PROVIDED', // We need to make sure this is mapped in activity-mapper.ts
          resource: 'EngagementRequest',
          resourceId: request.id,
          reason: `Member submitted requested info`,
          previousState: { status: request.status },
          newState: {
            status: EngagementRequestStatus.UNDER_REVIEW,
          },
        },
      });

      // 3. Persist Notification in DB
      const notifInput = {
        userId: request.member.userId,
        memberEmail: request.member.user?.email,
        referenceCode: request.referenceCode,
        type: 'REQUEST_INFO_PROVIDED',
        titleEn: 'Information Submitted',
        titleAr: 'تم تقديم المعلومات المطلوبة',
        messageEn: `Additional information for request (${request.referenceCode}) has been submitted and is back under review.`,
        messageAr: `تم تقديم المعلومات الإضافية للطلب (${request.referenceCode}) وهو الآن قيد المراجعة مجدداً.`,
        link: `/requests/${request.referenceCode}`,
        metadata: { requestId: request.id, status: EngagementRequestStatus.UNDER_REVIEW },
      };
      await this.notificationSvc.saveInAppNotification(tx, notifInput);

      return {
        id: request.id,
        referenceCode: request.referenceCode,
        status: EngagementRequestStatus.UNDER_REVIEW,
        notifInput,
      };
    });

    // 4. Dispatch Email Outside Transaction
    this.notificationSvc.dispatchEmailOnly(updated.notifInput).catch(() => {});

    return {
      id: updated.id,
      referenceCode: updated.referenceCode,
      status: updated.status,
      message: 'Information submitted successfully. Your request is back under review.',
    };
  }
}
