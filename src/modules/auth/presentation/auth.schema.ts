import { z } from 'zod';
import { emailSchema } from '../../../shared/validation';

export const PASSWORD_ERROR_MESSAGE =
  'Enter a password of at least 8 characters, including an uppercase letter, a lowercase letter and a number.';

export const passwordSchema = z
  .string()
  .min(8, PASSWORD_ERROR_MESSAGE)
  .regex(/[A-Z]/, PASSWORD_ERROR_MESSAGE)
  .regex(/[a-z]/, PASSWORD_ERROR_MESSAGE)
  .regex(/[0-9]/, PASSWORD_ERROR_MESSAGE);

export const activateAccountSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export type ActivateAccountInput = z.infer<typeof activateAccountSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
