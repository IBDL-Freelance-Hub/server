import fs from 'fs';
import path from 'path';
import os from 'os';
import { StorageService } from '../../../../src/modules/files/infrastructure/storage.service';
import { NotFoundError, ValidationError } from '../../../../src/shared/errors';

describe('StorageService Unit Tests (UPL-05)', () => {
  let tempDir: string;
  let storageService: StorageService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
    storageService = new StorageService(tempDir);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should save a file buffer with a randomized key and sanitized extension', async () => {
    const data = Buffer.from('hello world');
    const storageKey = await storageService.saveFile(data, '.pdf');

    expect(storageKey).toMatch(/^[0-9a-f-]+\.pdf$/);
    const exists = await storageService.fileExists(storageKey);
    expect(exists).toBe(true);

    const retrieved = await storageService.getFileBuffer(storageKey);
    expect(retrieved.toString()).toBe('hello world');
  });

  it('should throw NotFoundError when getting non-existent file buffer', async () => {
    await expect(storageService.getFileBuffer('non-existent-key.pdf')).rejects.toThrow(
      NotFoundError,
    );
  });

  it('should throw NotFoundError when getting non-existent file stream', () => {
    expect(() => storageService.getFileInputStream('non-existent-key.pdf')).toThrow(NotFoundError);
  });

  it('should return a readable stream for an existing file', async () => {
    const data = Buffer.from('stream test content');
    const storageKey = await storageService.saveFile(data, 'txt');

    const stream = storageService.getFileInputStream(storageKey);
    expect(stream).toBeDefined();

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const result = Buffer.concat(chunks).toString();
    expect(result).toBe('stream test content');
  });

  it('should delete a file from disk', async () => {
    const data = Buffer.from('delete me');
    const storageKey = await storageService.saveFile(data, 'pdf');

    expect(await storageService.fileExists(storageKey)).toBe(true);
    await storageService.deleteFile(storageKey);
    expect(await storageService.fileExists(storageKey)).toBe(false);
  });

  it('should guard against path traversal attacks and throw ValidationError', () => {
    const internal = storageService as unknown as {
      resolveSafePath: (k: string) => string;
    };
    jest.spyOn(path, 'resolve').mockReturnValueOnce('/etc/passwd');

    expect(() => internal.resolveSafePath('malicious-key')).toThrow(ValidationError);
  });
});
