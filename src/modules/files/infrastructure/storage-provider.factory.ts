import { StorageProvider } from '../domain/storage-provider.interface';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { R2StorageProvider } from './r2-storage.provider';
import { env } from '../../../config/env.config';

let cachedProvider: StorageProvider | null = null;

export function getStorageProvider(
  providerType: 'local' | 'r2' = env.STORAGE_PROVIDER,
): StorageProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  if (providerType === 'r2') {
    if (
      !env.R2_ACCOUNT_ID ||
      !env.R2_ACCESS_KEY_ID ||
      !env.R2_SECRET_ACCESS_KEY ||
      !env.R2_BUCKET_NAME
    ) {
      throw new Error(
        'Missing required Cloudflare R2 environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)',
      );
    }

    cachedProvider = new R2StorageProvider({
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucketName: env.R2_BUCKET_NAME,
      endpoint: env.R2_ENDPOINT,
    });
    return cachedProvider;
  }

  cachedProvider = new LocalDiskStorageProvider();
  return cachedProvider;
}

/**
 * Reset function used exclusively for testing provider switching.
 */
export function resetStorageProviderCache(): void {
  cachedProvider = null;
}

export const defaultStorageProvider = getStorageProvider();
