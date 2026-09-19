import {
  getStorageProvider,
  resetStorageProviderCache,
} from '../../../../src/modules/files/infrastructure/storage-provider.factory';
import { LocalDiskStorageProvider } from '../../../../src/modules/files/infrastructure/local-disk-storage.provider';
import { R2StorageProvider } from '../../../../src/modules/files/infrastructure/r2-storage.provider';
import { env } from '../../../../src/config/env.config';

describe('StorageProviderFactory Unit Tests', () => {
  const originalEnv = { ...env };

  beforeEach(() => {
    resetStorageProviderCache();
    Object.assign(env, originalEnv);
  });

  afterEach(() => {
    resetStorageProviderCache();
    Object.assign(env, originalEnv);
  });

  it('should instantiate LocalDiskStorageProvider when provider is local', () => {
    const provider = getStorageProvider('local');
    expect(provider).toBeInstanceOf(LocalDiskStorageProvider);
  });

  it('should reuse cached provider instance across calls', () => {
    const provider1 = getStorageProvider('local');
    const provider2 = getStorageProvider('local');
    expect(provider1).toBe(provider2);
  });

  it('should throw error when r2 is selected but required env variables are missing', () => {
    (env as unknown as { R2_ACCOUNT_ID?: string }).R2_ACCOUNT_ID = undefined;
    (env as unknown as { R2_ACCESS_KEY_ID?: string }).R2_ACCESS_KEY_ID = undefined;
    (env as unknown as { R2_SECRET_ACCESS_KEY?: string }).R2_SECRET_ACCESS_KEY = undefined;
    (env as unknown as { R2_BUCKET_NAME?: string }).R2_BUCKET_NAME = undefined;

    expect(() => getStorageProvider('r2')).toThrow(
      /Missing required Cloudflare R2 environment variables/,
    );
  });

  it('should instantiate R2StorageProvider when provider is r2 and credentials are present', () => {
    (env as unknown as { R2_ACCOUNT_ID?: string }).R2_ACCOUNT_ID = 'test-account';
    (env as unknown as { R2_ACCESS_KEY_ID?: string }).R2_ACCESS_KEY_ID = 'test-key';
    (env as unknown as { R2_SECRET_ACCESS_KEY?: string }).R2_SECRET_ACCESS_KEY = 'test-secret';
    (env as unknown as { R2_BUCKET_NAME?: string }).R2_BUCKET_NAME = 'test-bucket';

    const provider = getStorageProvider('r2');
    expect(provider).toBeInstanceOf(R2StorageProvider);
  });
});
