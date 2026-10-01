import { z } from 'zod';
import { EngagementRequestStatus, CatalogItemCategory } from '@prisma/client';

export const listMemberRequestsQuerySchema = z.object({
  status: z.nativeEnum(EngagementRequestStatus).optional(),
  category: z.nativeEnum(CatalogItemCategory).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const requestIdOrRefParamSchema = z
  .object({
    id: z.string().trim().optional(),
    referenceCode: z.string().trim().optional(),
  })
  .refine((data) => Boolean(data.id || data.referenceCode), {
    message: 'Request ID or reference code parameter is required',
  });

export const referenceCodeParamSchema = z.object({
  referenceCode: z.string().trim().min(1, 'referenceCode is required'),
});

export const cancelMemberRequestSchema = z.object({
  reason: z.string().max(1000, 'Cancellation reason cannot exceed 1000 characters').optional(),
});

export const payMemberRequestSchema = z.object({
  paymentMethodId: z.string().optional(),
  gatewayToken: z.string().optional(),
});

export type ListMemberRequestsQueryInput = z.infer<typeof listMemberRequestsQuerySchema>;
export type CancelMemberRequestInput = z.infer<typeof cancelMemberRequestSchema>;
