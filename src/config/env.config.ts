import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const envSchema = z
  .object({
    PORT: z.coerce.number().default(5000),
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .catch('production')
      .default('production'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    SESSION_SECRET: z
      .string()
      .min(1)
      .default('ibdl_freelancers_hub_default_secret_key_32chars_min'),
    CORS_ORIGIN: z.string().default('*'),
    LOG_LEVEL: z
      .string()
      .optional()
      .transform((val) => {
        const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
        return val && validLevels.includes(val.toLowerCase()) ? val.toLowerCase() : 'info';
      }),
    STORAGE_PROVIDER: z.enum(['local', 'r2']).default('local'),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET_NAME: z.string().optional(),
    R2_ENDPOINT: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.STORAGE_PROVIDER === 'r2') {
      if (!data.R2_ACCOUNT_ID || !data.R2_ACCOUNT_ID.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['R2_ACCOUNT_ID'],
          message: 'R2_ACCOUNT_ID is required when STORAGE_PROVIDER=r2',
        });
      }
      if (!data.R2_ACCESS_KEY_ID || !data.R2_ACCESS_KEY_ID.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['R2_ACCESS_KEY_ID'],
          message: 'R2_ACCESS_KEY_ID is required when STORAGE_PROVIDER=r2',
        });
      }
      if (!data.R2_SECRET_ACCESS_KEY || !data.R2_SECRET_ACCESS_KEY.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['R2_SECRET_ACCESS_KEY'],
          message: 'R2_SECRET_ACCESS_KEY is required when STORAGE_PROVIDER=r2',
        });
      }
      if (!data.R2_BUCKET_NAME || !data.R2_BUCKET_NAME.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['R2_BUCKET_NAME'],
          message: 'R2_BUCKET_NAME is required when STORAGE_PROVIDER=r2',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(rawEnv: Record<string, unknown> = process.env): Env {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const errorDetails = JSON.stringify(result.error.format(), null, 2);
    console.error('❌ Environment Variable Validation Failure:\n', errorDetails);

    // Fail-fast and loudly if R2 is explicitly selected without required credentials
    if (rawEnv.STORAGE_PROVIDER === 'r2') {
      throw new Error(
        `Failed to start: STORAGE_PROVIDER=r2 requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.\n${errorDetails}`,
      );
    }

    return {
      PORT: Number(rawEnv.PORT) || 5000,
      NODE_ENV: (rawEnv.NODE_ENV as 'production') || 'production',
      DATABASE_URL: (rawEnv.DATABASE_URL as string) || '',
      SESSION_SECRET:
        (rawEnv.SESSION_SECRET as string) || 'ibdl_freelancers_hub_default_secret_key_32chars_min',
      CORS_ORIGIN: (rawEnv.CORS_ORIGIN as string) || '*',
      LOG_LEVEL: 'info',
      STORAGE_PROVIDER: 'local',
      R2_ACCOUNT_ID: undefined,
      R2_ACCESS_KEY_ID: undefined,
      R2_SECRET_ACCESS_KEY: undefined,
      R2_BUCKET_NAME: undefined,
      R2_ENDPOINT: undefined,
    };
  }

  return result.data;
}

export const env: Env = validateEnv(process.env);
