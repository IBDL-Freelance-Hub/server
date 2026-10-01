import { PrismaClient, EngagementRequestStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError, BusinessRuleError } from '../../../shared/errors';
import { assertValidRequestTransition } from '../domain/request-state-machine';
import {
  IRequestNotificationService,
  requestNotificationService as defaultNotificationService,
} from './services/request-notification.service';

export interface PayMemberRequestInput {
  paymentMethodId?: string;
  gatewayToken?: string;
}

export interface PayMemberRequestResult {
  id: string;
  referenceCode: string;
  status: EngagementRequestStatus;
  paymentReference: string;
  paidAt: string;
  message: string;
}

export class PayMemberRequestUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly notificationSvc: IRequestNotificationService = defaultNotificationService,
  ) {}

  async execute(
    userId: string,
    identifier: string,
    input: PayMemberRequestInput,
    meta?: { ipAddress?: string; requestId?: string },
  ): Promise<PayMemberRequestResult> {
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

    assertValidRequestTransition(request.status, EngagementRequestStatus.PAYMENT_CONFIRMED);

    if (request.status !== EngagementRequestStatus.AWAITING_PAYMENT) {
      throw new BusinessRuleError(
        `Request is in '${request.status}' status. Payment can only be initiated for requests in AWAITING_PAYMENT status.`,
      );
    }

    // Simulate payment gateway interaction
    const simulatedRef = `PAY-SIM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const paymentReference = input.gatewayToken || input.paymentMethodId || simulatedRef;
    const paidAt = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.engagementRequest.update({
        where: { id: request.id },
        data: {
          status: EngagementRequestStatus.PAYMENT_CONFIRMED,
          paymentReference,
          paidAt,
        },
      });

      // 1. Immutable Audit Log for Member Payment
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: 'MEMBER',
          action: 'MEMBER_PAYMENT_INITIATED',
          resource: 'EngagementRequest',
          resourceId: request.id,
          ipAddress: meta?.ipAddress,
          requestId: meta?.requestId,
          reason: `Payment initiated and confirmed via simulated gateway. Ref: ${paymentReference}`,
          previousState: { status: request.status },
          newState: {
            status: EngagementRequestStatus.PAYMENT_CONFIRMED,
            paymentReference,
            paidAt: paidAt.toISOString(),
          },
        },
      });

      // 2. Member Activity Feed Timeline Entry
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: 'MEMBER',
          action: 'REQUEST_PAYMENT_CONFIRMED',
          resource: 'EngagementRequest',
          resourceId: request.id,
          reason: `Payment successful. Reference: ${paymentReference}`,
          previousState: { status: request.status },
          newState: {
            status: EngagementRequestStatus.PAYMENT_CONFIRMED,
          },
        },
      });

      return rec;
    });

    // 3. Dispatch Member Notification
    await this.notificationSvc.dispatchNotification({
      userId,
      memberEmail: request.member.user?.email,
      referenceCode: request.referenceCode,
      type: 'REQUEST_PAYMENT_CONFIRMED',
      titleEn: 'Payment Successful',
      titleAr: 'تمت عملية الدفع بنجاح',
      messageEn: `Your payment for request (${request.referenceCode}) has been successfully processed.`,
      messageAr: `تمت معالجة الدفعة لطلبك (${request.referenceCode}) بنجاح.`,
      metadata: { requestId: request.id, status: EngagementRequestStatus.PAYMENT_CONFIRMED },
    });

    return {
      id: updated.id,
      referenceCode: updated.referenceCode,
      status: updated.status,
      paymentReference,
      paidAt: updated.paidAt!.toISOString(),
      message: 'Payment settled successfully.',
    };
  }
}
