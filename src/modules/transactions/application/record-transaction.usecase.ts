import { PrismaClient, TransactionStatus, PaymentMethod, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { ValidationError } from '../../../shared/errors';
import { generateAtomicInvoiceNumber } from '../domain/invoice-reference';

export interface RecordTransactionInput {
  userId: string;
  sourceType: 'REQUEST' | 'SHOP_ORDER' | 'SUBSCRIPTION';
  sourceId: string;
  amountCents: number;
  currency?: string;
  paymentMethod?: PaymentMethod;
  paymentReference: string;
  billingDetails: Record<string, unknown>;
  paidAt?: Date;
  actorMeta?: {
    actorId?: string;
    actorRole?: string;
    ipAddress?: string;
    requestId?: string;
  };
}

export interface RecordTransactionResult {
  id: string;
  invoiceNumber: string;
  status: TransactionStatus;
  paidAt: string;
  isIdempotent?: boolean;
}

export class RecordTransactionUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  /**
   * Records a transaction inside an existing transaction client (tx) or standalone.
   */
  async execute(
    input: RecordTransactionInput,
    txClient?: Prisma.TransactionClient,
  ): Promise<RecordTransactionResult> {
    if (input.amountCents < 0) {
      throw new ValidationError('Transaction amountCents cannot be negative.');
    }

    const ref = input.paymentReference?.trim();
    if (!ref) {
      throw new ValidationError('Transaction paymentReference is required.');
    }

    const run = async (tx: Prisma.TransactionClient): Promise<RecordTransactionResult> => {
      // 1. Idempotency Check: if paymentReference already exists in ledger, return existing
      const existing = await tx.transaction.findUnique({
        where: { paymentReference: ref },
      });

      if (existing) {
        return {
          id: existing.id,
          invoiceNumber: existing.invoiceNumber,
          status: existing.status,
          paidAt: existing.paidAt.toISOString(),
          isIdempotent: true,
        };
      }

      // 2. Generate atomic invoice number
      const invoiceNumber = await generateAtomicInvoiceNumber(tx);
      const paidDate = input.paidAt || new Date();

      // 3. Create Transaction ledger row
      const transaction = await tx.transaction.create({
        data: {
          invoiceNumber,
          userId: input.userId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          amountCents: Math.round(input.amountCents),
          currency: input.currency || 'USD',
          status: TransactionStatus.PAID,
          paymentMethod: input.paymentMethod || PaymentMethod.ADMIN_MANUAL,
          paymentReference: ref,
          billingDetails: input.billingDetails as unknown as Prisma.InputJsonValue,
          paidAt: paidDate,
        },
      });

      // 4. Audit Log for Transaction Creation (SEC-33)
      await tx.auditLog.create({
        data: {
          actorId: input.actorMeta?.actorId || input.userId,
          actorRole: input.actorMeta?.actorRole || 'SYSTEM',
          action: 'TRANSACTION_RECORDED',
          resource: 'Transaction',
          resourceId: transaction.id,
          reason: `Invoice ${invoiceNumber} issued for ${input.sourceType} ${input.sourceId}. Amount: ${input.amountCents} cents.`,
          ipAddress: input.actorMeta?.ipAddress,
          requestId: input.actorMeta?.requestId,
          newState: {
            invoiceNumber,
            userId: input.userId,
            amountCents: transaction.amountCents,
            currency: transaction.currency,
            status: transaction.status,
            paymentReference: ref,
          },
        },
      });

      return {
        id: transaction.id,
        invoiceNumber: transaction.invoiceNumber,
        status: transaction.status,
        paidAt: transaction.paidAt.toISOString(),
        isIdempotent: false,
      };
    };

    if (txClient) {
      return run(txClient);
    }

    return this.prisma.$transaction(async (tx) => run(tx), {
      maxWait: 10000,
      timeout: 20000,
    });
  }
}

export const recordTransactionUseCase = new RecordTransactionUseCase();
