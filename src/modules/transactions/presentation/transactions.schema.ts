import { z } from 'zod';
import { TransactionStatus } from '@prisma/client';

export const invoiceNumberParamSchema = z.object({
  invoiceNumber: z
    .string()
    .trim()
    .regex(/^INV-\d{4}-\d{5,}$/, {
      message: 'Invalid invoice number format. Expected INV-YYYY-0nnnn',
    }),
});

export const listMemberTransactionsQuerySchema = z.object({
  cursor: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sourceType: z.enum(['REQUEST', 'SHOP_ORDER', 'SUBSCRIPTION']).optional(),
  status: z.nativeEnum(TransactionStatus).optional(),
});

export const adminListTransactionsQuerySchema = z.object({
  cursor: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().uuid().optional(),
  sourceType: z.enum(['REQUEST', 'SHOP_ORDER', 'SUBSCRIPTION']).optional(),
  status: z.nativeEnum(TransactionStatus).optional(),
});

export type ListMemberTransactionsQueryInput = z.infer<typeof listMemberTransactionsQuerySchema>;
export type AdminListTransactionsQueryInput = z.infer<typeof adminListTransactionsQuerySchema>;
export type InvoiceNumberParamInput = z.infer<typeof invoiceNumberParamSchema>;
