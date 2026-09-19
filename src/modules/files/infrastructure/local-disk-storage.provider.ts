import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import {
  StorageProvider,
  DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
} from '../domain/storage-provider.interface';
import { NotFoundError, ValidationError } from '../../../shared/errors';
import { env } from '../../../config/env.config';

export class LocalDiskStorageProvider implements StorageProvider {
  private readonly uploadDir: string;
  private readonly signingSecret: string;

  constructor(customUploadDir?: string, signingSecret?: string) {
    const isServerless = Boolean(
      process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT,
    );
    const defaultDir = isServerless
      ? path.join(os.tmpdir(), 'uploads')
      : path.resolve(process.cwd(), 'uploads');

    this.uploadDir = customUploadDir || process.env.UPLOAD_DIR || defaultDir;
    this.signingSecret =
      signingSecret || env.SESSION_SECRET || 'ibdl_freelancers_hub_default_secret_key_32chars_min';

    // Ensure uploads directory exists on disk safely
    try {
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
    } catch (err) {
      console.warn('[LocalDiskStorageProvider] Could not create uploads directory:', err);
    }
  }

  /**
   * Persists a file buffer to disk.
   */
  async save(buffer: Buffer, key: string, _mimeType: string): Promise<string> {
    const filePath = this.resolveSafePath(key);
    await fs.promises.writeFile(filePath, buffer);
    return key;
  }

  /**
   * Generates a temporary, time-limited HMAC-signed URL for downloading from local disk.
   * Simulates Cloudflare R2 / S3 pre-signed URL behavior and expiration in development.
   */
  async getSignedDownloadUrl(
    storageKey: string,
    expiresInSeconds: number = DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
  ): Promise<string> {
    const filePath = this.resolveSafePath(storageKey);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('File not found in storage');
    }

    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = this.generateSignature(storageKey, expiresAt);

    return `/api/v1/files/raw/${encodeURIComponent(storageKey)}?expires=${expiresAt}&sig=${signature}`;
  }

  /**
   * Validates whether a signed URL is authentic and not expired.
   */
  verifySignedUrl(storageKey: string, expiresAt: number, signature: string): boolean {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds > expiresAt) {
      return false; // Expired
    }

    const expectedSignature = this.generateSignature(storageKey, expiresAt);
    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const expectedBuf = Buffer.from(expectedSignature, 'hex');
      if (sigBuf.length !== expectedBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  }

  /**
   * Deletes a file from storage.
   */
  async delete(storageKey: string): Promise<void> {
    const filePath = this.resolveSafePath(storageKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  /**
   * Returns a readable stream for high-performance file downloads (used by /raw/:storageKey).
   */
  getFileInputStream(storageKey: string): fs.ReadStream {
    const filePath = this.resolveSafePath(storageKey);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('File not found in storage');
    }
    return fs.createReadStream(filePath);
  }

  /**
   * Checks if a file exists on disk.
   */
  async fileExists(storageKey: string): Promise<boolean> {
    const filePath = this.resolveSafePath(storageKey);
    return fs.existsSync(filePath);
  }

  /**
   * Retrieves the raw Buffer of a stored file (for testing/inspection).
   */
  async getFileBuffer(storageKey: string): Promise<Buffer> {
    const filePath = this.resolveSafePath(storageKey);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('File not found in storage');
    }
    return fs.promises.readFile(filePath);
  }

  private generateSignature(storageKey: string, expiresAt: number): string {
    return crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${storageKey}:${expiresAt}`)
      .digest('hex');
  }

  /**
   * Resolves a storageKey safely within uploadDir to prevent path traversal (UPL-05).
   */
  private resolveSafePath(storageKey: string): string {
    const sanitizedKey = path.basename(storageKey);
    const resolvedPath = path.resolve(this.uploadDir, sanitizedKey);

    // Guard against directory traversal attacks
    if (!resolvedPath.startsWith(this.uploadDir)) {
      throw new ValidationError('Invalid storage key: path traversal detected');
    }

    return resolvedPath;
  }
}
