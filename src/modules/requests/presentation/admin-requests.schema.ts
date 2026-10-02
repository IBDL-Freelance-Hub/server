import { z } from 'zod';
import { EngagementRequestStatus, CatalogItemCategory } from '@prisma/client';

export const adminListRequestsQuerySchema = z.object({
  status: z.nativeEnum(EngagementRequestStatus).optional(),
  category: z.nativeEnum(CatalogItemCategory).optional(),
  memberId: z.string().uuid('Invalid memberId UUID').optional(),
  search: z.string().trim().max(100, 'Search query cannot exceed 100 characters').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminRequestIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Request ID or reference code parameter is required'),
});

export const adminRequestInfoSchema = z.object({
  reviewNotes: z
    .string({ required_error: 'reviewNotes is required' })
    .trim()
    .min(5, 'reviewNotes must be at least 5 characters long'),
});

export const adminRejectRequestSchema = z.object({
  rejectionReason: z
    .string({ required_error: 'rejectionReason is required' })
    .trim()
    .min(5, 'rejectionReason must be at least 5 characters long'),
});

export const adminApproveRequestSchema = z.object({
  baseAmount: z
    .number()
    .int('baseAmount must be an integer minor units (cents)')
    .nonnegative('baseAmount cannot be negative')
    .max(2147483647, 'baseAmount exceeds maximum allowed value')
    .optional(),
  adminNotes: z.string().trim().optional(),
});

export const adminFulfillRequestSchema = z.object({
  deliveryNotes: z.string().trim().optional(),
  customAccessUrl: z.string().url('customAccessUrl must be a valid URL').optional(),
});

export const adminMarkPaidSchema = z
  .object({
    paymentRef: z.string().trim().optional(),
    paymentReference: z.string().trim().optional(),
    paidAmount: z
      .number()
      .int()
      .positive()
      .max(2147483647, 'paidAmount exceeds maximum allowed value')
      .optional(),
    adminNotes: z.string().trim().optional(),
  })
  .refine((data) => Boolean(data.paymentRef || data.paymentReference), {
    message: 'Either paymentRef or paymentReference is required',
    path: ['paymentRef'],
  });
