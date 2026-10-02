import { PrismaClient, EngagementRequestStatus, PaymentMethod } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError, BusinessRuleError, ConflictError } from '../../../shared/errors';
import { assertValidRequestTransition } from '../domain/request-state-machine';
import {
  IRequestNotificationService,
  requestNotificationService as defaultNotificationService,
} from './services/request-notification.service';
import { RecordTransactionUseCase } from '../../transactions/application/record-transaction.usecase';

export interface PayMemberRequestInput {
  paymentMethodId?: string;
  gatewayToken?: string;
  paymentReference?: string;
}

export interface PayMemberRequestResult {
  id: string;
  referenceCode: string;
  status: EngagementRequestStatus;
  paymentReference: string;
  invoiceNumber?: string;
  paidAt: string;
  isIdempotent?: boolean;
  message: string;
}

export class PayMemberRequestUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly notificationSvc: IRequestNotificationService = defaultNotificationService,
    private readonly recordTransactionUseCase: RecordTransactionUseCase = new RecordTransactionUseCase(
      prisma,
    ),
  ) {}

  async execute(
    userId: string,
    identifier: string,
    input: PayMemberRequestInput = {},
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
            fullNameEn: true,
            user: { select: { email: true } },
          },
        },
        catalogItem: { select: { nameEn: true } },
      },
    });

    if (!request || request.member.userId !== userId) {
      throw new NotFoundError(`Engagement request '${identifier}' not found.`);
    }

    // Idempotency: If request is already PAYMENT_CONFIRMED or FULFILLED, return existing record
    if (
      request.status === EngagementRequestStatus.PAYMENT_CONFIRMED ||
      request.status === EngagementRequestStatus.FULFILLED
    ) {
      const existingTx = request.paymentReference
        ? await this.prisma.transaction.findUnique({
            where: { paymentReference: request.paymentReference },
            select: { invoiceNumber: true },
          })
        : null;

      return {
        id: request.id,
        referenceCode: request.referenceCode,
        status: request.status,
        paymentReference: request.paymentReference || '',
        invoiceNumber: existingTx?.invoiceNumber,
        paidAt: (request.paidAt || new Date()).toISOString(),
        isIdempotent: true,
        message: 'Payment was already confirmed for this request.',
      };
    }

    assertValidRequestTransition(request.status, EngagementRequestStatus.PAYMENT_CONFIRMED);

    if (request.status !== EngagementRequestStatus.AWAITING_PAYMENT) {
      throw new BusinessRuleError(
        `Request is in '${request.status}' status. Payment can only be initiated for requests in AWAITING_PAYMENT status.`,
      );
    }

    // Simulate payment gateway interaction
    const simulatedRef = `PAY-SIM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const paymentReference =
      input.paymentReference?.trim() ||
      input.gatewayToken?.trim() ||
      input.paymentMethodId?.trim() ||
      simulatedRef;
    const now = new Date();

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const updateResult = await tx.engagementRequest.updateMany({
          where: { id: request.id, status: request.status },
          data: {
            status: EngagementRequestStatus.PAYMENT_CONFIRMED,
            paymentReference,
            paidAt: now,
          },
        });

        if (updateResult.count === 0) {
          throw new ConflictError(
            `Request status was updated concurrently. Expected '${request.status}' but it has changed. Please refresh and try again.`,
          );
        }

        // Record transaction in ledger if payable amount > 0
        let invoiceNumber: string | undefined;
        const amountCents = Math.round(Number(request.finalPrice) * 100);

        if (amountCents > 0) {
          const txRecord = await this.recordTransactionUseCase.execute(
            {
              userId,
              sourceType: 'REQUEST',
              sourceId: request.id,
              amountCents,
              currency: request.currency || 'USD',
              paymentMethod: PaymentMethod.SIMULATED_GATEWAY,
              paymentReference,
              billingDetails: {
                memberName: request.member.fullNameEn,
                email: request.member.user?.email,
                tier: request.tierAtRequest,
                itemTitle: request.catalogItem.nameEn,
                basePrice: Number(request.basePrice),
                discountRate: Number(request.discountPercentage),
                discountAmount: Number(request.basePrice) - Number(request.finalPrice),
                finalPrice: Number(request.finalPrice),
                paidAt: now.toISOString(),
                sourceType: 'REQUEST',
                sourceRef: request.referenceCode,
              },
              paidAt: now,
              actorMeta: {
                actorId: userId,
                actorRole: 'MEMBER',
                ipAddress: meta?.ipAddress,
                requestId: meta?.requestId,
              },
            },
            tx,
          );
          invoiceNumber = txRecord.invoiceNumber;
        }

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
              paidAt: now.toISOString(),
              invoiceNumber,
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

        // 3. Persist In-App Notification in DB
        const notifInput = {
          userId,
          memberEmail: request.member.user?.email,
          referenceCode: request.referenceCode,
          type: 'REQUEST_PAYMENT_CONFIRMED',
          titleEn: 'Payment Successful',
          titleAr: 'تمت عملية الدفع بنجاح',
          messageEn: `Your payment for request (${request.referenceCode}) has been successfully processed (Invoice: ${invoiceNumber || 'N/A'}).`,
          messageAr: `تمت معالجة الدفعة لطلبك (${request.referenceCode}) بنجاح.`,
          metadata: {
            requestId: request.id,
            paymentReference,
            invoiceNumber,
            status: EngagementRequestStatus.PAYMENT_CONFIRMED,
          },
        };
        await this.notificationSvc.saveInAppNotification(tx, notifInput);

        return {
          id: request.id,
          referenceCode: request.referenceCode,
          status: EngagementRequestStatus.PAYMENT_CONFIRMED,
          paymentReference,
          invoiceNumber,
          paidAt: now,
          notifInput,
        };
      },
      { maxWait: 10000, timeout: 20000 },
    );

    // 4. Dispatch Email Outside Transaction
    this.notificationSvc.dispatchEmailOnly(updated.notifInput).catch(() => {});

    return {
      id: updated.id,
      referenceCode: updated.referenceCode,
      status: updated.status,
      paymentReference: updated.paymentReference,
      invoiceNumber: updated.invoiceNumber,
      paidAt: updated.paidAt.toISOString(),
      isIdempotent: false,
      message: 'Payment settled successfully.',
    };
  }
}
