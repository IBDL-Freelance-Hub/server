import crypto from 'crypto';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';

export class StorageService extends LocalDiskStorageProvider {
  async saveFile(buffer: Buffer, extension: string): Promise<string> {
    const sanitizedExt = extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const uniqueId = crypto.randomUUID();
    const storageKey = `${uniqueId}.${sanitizedExt}`;
    return this.save(buffer, storageKey, 'application/octet-stream');
  }

  async deleteFile(storageKey: string): Promise<void> {
    return this.delete(storageKey);
  }
}

export const storageService = new StorageService();
