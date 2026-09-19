/**
 * Standard default expiry window for temporary pre-signed download URLs.
 * Set to 900 seconds (15 minutes) for parity across all drivers.
 */
export const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 900;

/**
 * Provider-agnostic storage interface.
 * Implemented by LocalDiskStorageProvider (dev/test) and R2StorageProvider (production).
 */
export interface StorageProvider {
  /**
   * Persists a file buffer with a given key and MIME type.
   * Returns the canonical storageKey actually persisted.
   */
  save(buffer: Buffer, key: string, mimeType: string): Promise<string>;

  /**
   * Generates a temporary, time-limited signed URL for downloading the file.
   * Enforces expiry logic across all drivers (including local disk).
   */
  getSignedDownloadUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;

  /**
   * Deletes a file from the storage backend.
   */
  delete(storageKey: string): Promise<void>;
}
