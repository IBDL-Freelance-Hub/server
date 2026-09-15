import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).catch('production').default('production'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(1).default('ibdl_freelancers_hub_default_secret_key_32chars_min'),
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z
    .string()
    .optional()
    .transform((val) => {
      const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
      return val && validLevels.includes(val.toLowerCase()) ? val.toLowerCase() : 'info';
    }),
});

export type Env = z.infer<typeof envSchema>;

const envResult = envSchema.safeParse(process.env);

if (!envResult.success) {
  console.error(
    '❌ Environment Variable Validation Failure:',
    JSON.stringify(envResult.error.format(), null, 2),
  );
}

export const env: Env = envResult.success
  ? envResult.data
  : {
      PORT: Number(process.env.PORT) || 5000,
      NODE_ENV: (process.env.NODE_ENV as 'production') || 'production',
      DATABASE_URL: process.env.DATABASE_URL || '',
      SESSION_SECRET:
        process.env.SESSION_SECRET || 'ibdl_freelancers_hub_default_secret_key_32chars_min',
      CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
      LOG_LEVEL: 'info',
    };
