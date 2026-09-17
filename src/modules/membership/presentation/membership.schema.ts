import { z } from 'zod';

export const upgradeMembershipSchema = z
  .object({
    targetTier: z.enum(['PROFESSIONAL', 'MASTER'], {
      errorMap: () => ({ message: 'Target tier must be either PROFESSIONAL or MASTER' }),
    }),
    paymentMethodToken: z.string().trim().optional(),
    simulationOutcome: z.enum(['SUCCESS', 'FAIL', 'PENDING']).optional(),
  })
  .strict({
    message:
      'Unexpected fields supplied. Pricing and discounts are strictly computed on the server.',
  });

export type UpgradeMembershipInput = z.infer<typeof upgradeMembershipSchema>;
