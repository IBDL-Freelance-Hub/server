import { z } from 'zod';
import { emailSchema } from '../../../shared/validation';

export const experienceBands = ['<2', '2-5', '6-10', '11-15', '>15'] as const;

export const registerMemberSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters long'),
  email: emailSchema,
  mobile: z
    .string()
    .trim()
    .refine((val) => val.replace(/\D/g, '').length >= 7, {
      message: 'Mobile number must contain at least 7 digits',
    }),
  country: z.string().trim().min(1, 'Country is required'),
  linkedinUrl: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || z.string().url().safeParse(val).success, {
      message: 'Invalid LinkedIn URL format',
    }),
  yearsOfExperience: z.enum(experienceBands, {
    errorMap: () => ({ message: 'Invalid years of experience band selected' }),
  }),
  areasOfExpertise: z.array(z.string()).default([]),
  industriesServed: z.array(z.string()).default([]),
  bio: z.string().trim().optional(),
  message: z.string().trim().optional(),
  cvFileId: z.string().trim().optional(),
  directoryOptIn: z.boolean().default(false),
  termsAccepted: z.literal(true, {
    errorMap: () => ({
      message: 'You must agree to the terms to complete registration.',
    }),
  }),
});

export type RegisterMemberInput = z.infer<typeof registerMemberSchema>;
