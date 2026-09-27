import { z } from 'zod';
import { MembershipTier } from '@prisma/client';

export const directoryFilterQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  expertise: z
    .preprocess(
      (val) => {
        if (typeof val === 'string') {
          if (val.includes(',')) {
            return val
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
          }
          return val.trim() ? [val.trim()] : undefined;
        }
        return val;
      },
      z.union([z.string(), z.array(z.string())]),
    )
    .optional(),
  industry: z
    .preprocess(
      (val) => {
        if (typeof val === 'string') {
          if (val.includes(',')) {
            return val
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
          }
          return val.trim() ? [val.trim()] : undefined;
        }
        return val;
      },
      z.union([z.string(), z.array(z.string())]),
    )
    .optional(),
  language: z
    .preprocess(
      (val) => {
        if (typeof val === 'string') {
          if (val.includes(',')) {
            return val
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
          }
          return val.trim() ? [val.trim()] : undefined;
        }
        return val;
      },
      z.union([z.string(), z.array(z.string())]),
    )
    .optional(),
  country: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  tier: z.nativeEnum(MembershipTier).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(12),
});

export type DirectoryFilterQueryInput = z.infer<typeof directoryFilterQuerySchema>;

export const getTrainerSlugParamsSchema = z.object({
  slug: z.string().trim().min(1, 'Trainer slug parameter is required'),
});

export type GetTrainerSlugParamsInput = z.infer<typeof getTrainerSlugParamsSchema>;
