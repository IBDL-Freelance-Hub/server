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

export const activateAccountSchema = z.object({
  token: z.string().min(1, 'Activation token is required'),
  password: z.string().min(1, 'Password is required'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
});

export const resendActivationSchema = z.object({
  email: emailSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type ActivateAccountInput = z.infer<typeof activateAccountSchema>;
export type ResendActivationInput = z.infer<typeof resendActivationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
