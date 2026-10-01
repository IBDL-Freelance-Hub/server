import { z } from 'zod';

export const slugParamSchema = z.object({
  slug: z.string().trim().min(1, 'Service slug is required').max(100),
});

export const requestCoreServiceSchema = z.object({
  customRequirements: z.string().max(5000, 'Requirements cannot exceed 5000 characters').optional(),
  intakeData: z.record(z.unknown()).optional(),
});

export type RequestCoreServiceInput = z.infer<typeof requestCoreServiceSchema>;
