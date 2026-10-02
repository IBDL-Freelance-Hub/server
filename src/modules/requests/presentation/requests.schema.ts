import { z } from 'zod';

export const submitRequestSchema = z.object({
  itemSlug: z.string().trim().min(1, 'Item slug is required').max(100),
  brief: z
    .record(z.unknown())
    .default({})
    .refine((val) => JSON.stringify(val).length <= 51200, {
      message: 'Brief data payload exceeds the maximum allowed size (50KB)',
    }),
  acknowledgement: z
    .boolean({ required_error: 'Acknowledgement is required' })
    .refine((val) => val === true, {
      message: 'Acknowledgement must be accepted to proceed with request submission.',
    }),
  customRequirements: z.string().max(5000).optional(),
});

export type SubmitRequestDTO = z.infer<typeof submitRequestSchema>;
