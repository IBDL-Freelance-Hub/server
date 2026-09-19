import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { NotFoundError, ValidationError } from '../../../shared/errors';

export class StorageService {
  private readonly uploadDir: string;

  constructor(customUploadDir?: string) {
    const isServerless = Boolean(
      process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT,
    );
    const defaultDir = isServerless
      ? path.join(os.tmpdir(), 'uploads')
      : path.resolve(process.cwd(), 'uploads');

    this.uploadDir = customUploadDir || process.env.UPLOAD_DIR || defaultDir;

    // Ensure uploads directory exists on disk safely
    try {
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
    } catch (err) {
      console.warn('[StorageService] Could not create uploads directory:', err);
    }
  }

  /**
   * Saves a buffer to secure storage with a randomized, non-guessable key (UUID.ext).
   * Prevents path traversal by strictly generating the filename internally (UPL-05).
   */
  async saveFile(buffer: Buffer, extension: string): Promise<string> {
    const sanitizedExt = extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const uniqueId = crypto.randomUUID();
    const storageKey = `${uniqueId}.${sanitizedExt}`;
    const filePath = this.resolveSafePath(storageKey);

    await fs.promises.writeFile(filePath, buffer);
    return storageKey;
  }

  /**
   * Retrieves the raw Buffer of a stored file.
   */
  async getFileBuffer(storageKey: string): Promise<Buffer> {
    const filePath = this.resolveSafePath(storageKey);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('File not found in storage');
    }

    return fs.promises.readFile(filePath);
  }

  /**
   * Returns a readable stream for high-performance file downloads.
   */
  getFileInputStream(storageKey: string): fs.ReadStream {
    const filePath = this.resolveSafePath(storageKey);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('File not found in storage');
    }

    return fs.createReadStream(filePath);
  }

  /**
   * Deletes a file from storage.
   */
  async deleteFile(storageKey: string): Promise<void> {
    const filePath = this.resolveSafePath(storageKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  /**
   * Checks if a file exists in storage.
   */
  async fileExists(storageKey: string): Promise<boolean> {
    const filePath = this.resolveSafePath(storageKey);
    return fs.existsSync(filePath);
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

export const storageService = new StorageService();
