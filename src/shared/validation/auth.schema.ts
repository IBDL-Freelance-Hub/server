import { z } from 'zod';
import { normalizeEmail } from '../utils/normalizeEmail';

export const StaffRoleEnum = z.enum([
  'REVIEWER_OPERATOR',
  'FINANCE_OFFICER',
  'SYSTEM_ADMINISTRATOR',
]);

export type StaffRole = z.infer<typeof StaffRoleEnum>;

export const emailSchema = z
  .string()
  .trim()
  .email('Invalid email address')
  .transform((val) => normalizeEmail(val));
