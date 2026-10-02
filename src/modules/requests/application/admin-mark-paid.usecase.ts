import { PrismaClient, EngagementRequestStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError, ValidationError } from '../../../shared/errors';
import { assertValidRequestTransition } from '../domain/request-state-machine';
import {
  IRequestNotificationService,
  requestNotificationService as defaultNotificationService,
} from './services/request-notification.service';
import { AdminActorContext } from './admin-start-review.usecase';

export interface AdminMarkPaidInput {
  paymentRef?: string;
  paymentReference?: string;
  paidAmount?: number;
  adminNotes?: string;
}

export interface AdminMarkPaidResult {
  id: string;
  referenceCode: string;
  status: EngagementRequestStatus;
  paymentReference: string;
  paidAt: string;
  isIdempotent?: boolean;
  message: string;
}

export class AdminMarkPaidUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly notificationSvc: IRequestNotificationService = defaultNotificationService,
  ) {}

  async execute(
    identifier: string,
    input: AdminMarkPaidInput,
    actor: AdminActorContext,
  ): Promise<AdminMarkPaidResult> {
    const refCode = (input.paymentRef || input.paymentReference)?.trim();
    if (!refCode) {
      throw new ValidationError('paymentRef (or paymentReference) is required to record payment.');
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

    // Idempotency: If request is already PAYMENT_CONFIRMED or FULFILLED, return existing record
    if (
      request.status === EngagementRequestStatus.PAYMENT_CONFIRMED ||
      request.status === EngagementRequestStatus.FULFILLED
    ) {
      return {
        id: request.id,
        referenceCode: request.referenceCode,
        status: request.status,
        paymentReference: request.paymentReference || refCode,
        paidAt: (request.paidAt || new Date()).toISOString(),
        isIdempotent: true,
        message: 'Payment was already confirmed for this request.',
      };
    }

    // Assert valid transition to PAYMENT_CONFIRMED (e.g. from AWAITING_PAYMENT)
    assertValidRequestTransition(request.status, EngagementRequestStatus.PAYMENT_CONFIRMED);

    const now = new Date();
    const adminNotesCombined = input.adminNotes?.trim()
      ? request.adminNotes
        ? `${request.adminNotes}\n[Payment]: ${input.adminNotes.trim()}`
        : `[Payment]: ${input.adminNotes.trim()}`
      : request.adminNotes;

    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.engagementRequest.update({
        where: { id: request.id },
        data: {
          status: EngagementRequestStatus.PAYMENT_CONFIRMED,
          paymentReference: refCode,
          paidAt: now,
          adminNotes: adminNotesCombined,
        },
      });

      // 1. Immutable Staff AuditLog (SEC-33)
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          actorRole: actor.staffRole,
          action: 'ADMIN_REQUEST_MARKED_PAID',
          resource: 'EngagementRequest',
          resourceId: request.id,
          reason: input.adminNotes?.trim() || `Payment recorded ref: ${refCode}`,
          ipAddress: actor.ipAddress,
          requestId: actor.requestId,
          previousState: { status: request.status, paymentReference: request.paymentReference },
          newState: {
            status: EngagementRequestStatus.PAYMENT_CONFIRMED,
            paymentReference: refCode,
            paidAt: now,
          },
        },
      });

      // 2. Member Activity Feed Timeline Entry (ACT-58)
      await tx.auditLog.create({
        data: {
          actorId: request.member.userId,
          actorRole: 'MEMBER',
          action: 'REQUEST_PAYMENT_CONFIRMED',
          resource: 'EngagementRequest',
          resourceId: request.id,
          reason: `Payment reference: ${refCode}`,
          previousState: { status: request.status },
          newState: { status: EngagementRequestStatus.PAYMENT_CONFIRMED },
        },
      });

      return rec;
    });

    // 3. Dispatch Member Notification
    await this.notificationSvc.dispatchNotification({
      userId: request.member.userId,
      memberEmail: request.member.user.email,
      referenceCode: request.referenceCode,
      type: 'REQUEST_PAYMENT_CONFIRMED',
      titleEn: 'Payment Confirmed',
      titleAr: 'تم تأكيد استلام الدفعة',
      messageEn: `Payment for request (${request.referenceCode}) has been confirmed (Ref: ${refCode}). Your request is now queued for fulfillment.`,
      messageAr: `تم تأكيد استلام دفعة الطلب (${request.referenceCode}) بنجاح (المرجع: ${refCode}). الطلب الآن في مرحلة التنفيذ.`,
      metadata: {
        requestId: request.id,
        paymentReference: refCode,
        status: EngagementRequestStatus.PAYMENT_CONFIRMED,
      },
    });

    return {
      id: updated.id,
      referenceCode: updated.referenceCode,
      status: updated.status,
      paymentReference: updated.paymentReference!,
      paidAt: updated.paidAt!.toISOString(),
      isIdempotent: false,
      message: 'Payment recorded and confirmed successfully.',
    };
  }
}

/**
 * Idempotent hook to mark an engagement request as paid.
 * Reuses AdminMarkPaidUseCase with system actor defaults.
 */
export async function markRequestPaid(
  requestId: string,
  paymentRef: string,
  adminNotes?: string,
  actor: AdminActorContext = {
    userId: 'SYSTEM',
    staffRole: 'SYSTEM_ADMIN',
    ipAddress: '127.0.0.1',
    requestId: 'system-payment-hook',
  },
  prisma: PrismaClient = defaultPrisma,
  notificationSvc: IRequestNotificationService = defaultNotificationService,
): Promise<AdminMarkPaidResult> {
  const useCase = new AdminMarkPaidUseCase(prisma, notificationSvc);
  return useCase.execute(requestId, { paymentRef, adminNotes }, actor);
}
