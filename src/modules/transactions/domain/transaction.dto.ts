import { TransactionStatus, PaymentMethod, Prisma } from '@prisma/client';

export interface TransactionDTO {
  id: string;
  invoiceNumber: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  amountCents: number;
  currency: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  billingDetails: Record<string, unknown>;
  paidAt: string;
  createdAt: string;
}

export function toTransactionDTO(transaction: {
  id: string;
  invoiceNumber: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  amountCents: number;
  currency: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  billingDetails: Prisma.JsonValue;
  paidAt: Date;
  createdAt: Date;
}): TransactionDTO {
  return {
    id: transaction.id,
    invoiceNumber: transaction.invoiceNumber,
    userId: transaction.userId,
    sourceType: transaction.sourceType,
    sourceId: transaction.sourceId,
    amountCents: transaction.amountCents,
    currency: transaction.currency,
    status: transaction.status,
    paymentMethod: transaction.paymentMethod,
    paymentReference: transaction.paymentReference,
    billingDetails: (transaction.billingDetails as Record<string, unknown>) || {},
    paidAt: transaction.paidAt.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
  };
}
