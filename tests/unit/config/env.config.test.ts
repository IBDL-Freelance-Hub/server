import { validateEnv, envSchema } from '../../../src/config/env.config';

describe('Environment Configuration & Validation Tests', () => {
  const baseValidEnv = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/testdb',
    NODE_ENV: 'test',
    SESSION_SECRET: 'test_secret_that_is_at_least_32_characters_long',
  };

  it('should default STORAGE_PROVIDER to local when omitted', () => {
    const parsed = validateEnv({
      ...baseValidEnv,
    });

    expect(parsed.STORAGE_PROVIDER).toBe('local');
  });

  it('should successfully validate when STORAGE_PROVIDER=r2 and all R2 keys are provided', () => {
    const parsed = validateEnv({
      ...baseValidEnv,
      STORAGE_PROVIDER: 'r2',
      R2_ACCOUNT_ID: 'acc-12345',
      R2_ACCESS_KEY_ID: 'key-12345',
      R2_SECRET_ACCESS_KEY: 'secret-12345',
      R2_BUCKET_NAME: 'test-bucket',
    });

    expect(parsed.STORAGE_PROVIDER).toBe('r2');
    expect(parsed.R2_ACCOUNT_ID).toBe('acc-12345');
    expect(parsed.R2_ACCESS_KEY_ID).toBe('key-12345');
    expect(parsed.R2_SECRET_ACCESS_KEY).toBe('secret-12345');
    expect(parsed.R2_BUCKET_NAME).toBe('test-bucket');
  });

  it('should fail-fast and throw an Error when STORAGE_PROVIDER=r2 is missing required R2 variables', () => {
    expect(() =>
      validateEnv({
        ...baseValidEnv,
        STORAGE_PROVIDER: 'r2',
      }),
    ).toThrow(/STORAGE_PROVIDER=r2 requires R2_ACCOUNT_ID/);
  });

  it('should add specific Zod issues for each missing R2 variable', () => {
    const parseResult = envSchema.safeParse({
      ...baseValidEnv,
      STORAGE_PROVIDER: 'r2',
    });

    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      expect(fieldErrors.R2_ACCOUNT_ID).toBeDefined();
      expect(fieldErrors.R2_ACCESS_KEY_ID).toBeDefined();
      expect(fieldErrors.R2_SECRET_ACCESS_KEY).toBeDefined();
      expect(fieldErrors.R2_BUCKET_NAME).toBeDefined();
    }
  });
});
