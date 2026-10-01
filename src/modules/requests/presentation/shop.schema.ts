import { z } from 'zod';

export const toolSlugParamSchema = z.object({
  slug: z.string().trim().min(1, 'Tool slug is required').max(100),
});

export const orderDiagnosticToolSchema = z.object({
  customRequirements: z.string().max(5000, 'Requirements cannot exceed 5000 characters').optional(),
  intakeData: z
    .object({
      targetOrganization: z.string().max(250).optional(),
      participantCount: z.coerce.number().int().min(1).max(500).optional(),
      assessmentEmail: z.string().email('Invalid email address format').optional(),
    })
    .passthrough()
    .optional(),
});

export type OrderDiagnosticToolInput = z.infer<typeof orderDiagnosticToolSchema>;
