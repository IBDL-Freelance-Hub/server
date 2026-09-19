import { z } from 'zod';
import { emailSchema } from '../../../shared/validation';

export const experienceBands = ['<2', '2-5', '6-10', '11-15', '>15'] as const;

// Configurable length defaults per VAL-08 (5,000 for multi-line fields, 250 for single-line)
export const DEFAULT_MULTI_LINE_MAX_LENGTH = 5000;
export const DEFAULT_SINGLE_LINE_MAX_LENGTH = 250;

export const formatBioTooLongMessage = (limit: number, lang: 'en' | 'ar' = 'en') =>
  lang === 'ar'
    ? `هذا الإدخال طويل جداً. يرجى تقصيره إلى ${limit} حرفاً أو أقل.`
    : `This entry is too long. Shorten it to ${limit} characters or fewer.`;

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
  bio: z
    .string()
    .trim()
    .max(
      DEFAULT_MULTI_LINE_MAX_LENGTH,
      formatBioTooLongMessage(DEFAULT_MULTI_LINE_MAX_LENGTH, 'en'),
    )
    .optional(),
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

export const checkDuplicateSchema = z
  .object({
    email: z.string().trim().optional(),
    mobile: z.string().trim().optional(),
    country: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      if (data.mobile && (!data.country || data.country.trim().length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: 'Country is required when mobile number is provided.',
      path: ['country'],
    },
  );

export type CheckDuplicateInput = z.infer<typeof checkDuplicateSchema>;

export const updateMemberProfileSchema = z
  .object({
    fullNameEn: z
      .string({ invalid_type_error: 'Full name in English must be a string' })
      .trim()
      .min(2, 'Full name in English must be at least 2 characters long')
      .optional(),
    fullNameAr: z
      .string()
      .trim()
      .refine((val) => val.length === 0 || val.length >= 2, {
        message: 'Arabic full name must be at least 2 characters long if provided',
      })
      .transform((val) => (val.length === 0 ? null : val))
      .nullable()
      .optional(),
    phone: z
      .string({ invalid_type_error: 'Phone number must be a string' })
      .trim()
      .refine((val) => val.replace(/\D/g, '').length >= 7, {
        message: 'Phone number must contain at least 7 digits',
      })
      .optional(),
    country: z.string().trim().min(1, 'Country cannot be empty').optional(),
    city: z
      .string({ invalid_type_error: 'City must be a string' })
      .trim()
      .min(1, 'City cannot be empty or whitespace (VAL-52, VAL-57)')
      .optional(),
    yearsOfExperience: z
      .enum(experienceBands, {
        errorMap: () => ({ message: 'Invalid years of experience band selected' }),
      })
      .optional(),
    areasOfExpertise: z.array(z.string().trim()).optional(),
    industriesServed: z.array(z.string().trim()).optional(),
    languages: z.array(z.string().trim()).optional(),
    bioEn: z
      .string()
      .trim()
      .max(
        DEFAULT_MULTI_LINE_MAX_LENGTH,
        formatBioTooLongMessage(DEFAULT_MULTI_LINE_MAX_LENGTH, 'en'),
      )
      .transform((val) => (val === '' ? null : val))
      .nullable()
      .optional(),
    bioAr: z
      .string()
      .trim()
      .max(
        DEFAULT_MULTI_LINE_MAX_LENGTH,
        formatBioTooLongMessage(DEFAULT_MULTI_LINE_MAX_LENGTH, 'ar'),
      )
      .transform((val) => (val === '' ? null : val))
      .nullable()
      .optional(),
    linkedinUrl: z
      .string()
      .trim()
      .refine((val) => !val || z.string().url().safeParse(val).success, {
        message: 'Invalid LinkedIn URL format',
      })
      .transform((val) => (!val ? null : val))
      .nullable()
      .optional(),
    directoryOptIn: z.boolean().optional(),
    email: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    if ('email' in data && (data as Record<string, unknown>).email !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Email address is read-only and cannot be modified (PRO-04, VAL-50)',
        path: ['email'],
      });
    }
  });

export type UpdateMemberProfileInput = z.infer<typeof updateMemberProfileSchema>;
