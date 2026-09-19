import fs from 'fs';
import path from 'path';
import os from 'os';
import { LocalDiskStorageProvider } from '../../../../src/modules/files/infrastructure/local-disk-storage.provider';
import { NotFoundError, ValidationError } from '../../../../src/shared/errors';

describe('LocalDiskStorageProvider Unit Tests', () => {
  let tempDir: string;
  let provider: LocalDiskStorageProvider;
  const testSecret = 'test_secret_for_local_disk_storage_32chars';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-disk-test-'));
    provider = new LocalDiskStorageProvider(tempDir, testSecret);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should save a file buffer to disk and verify existence', async () => {
    const key = 'test-file-1.pdf';
    const buffer = Buffer.from('pdf test content');
    const returnedKey = await provider.save(buffer, key, 'application/pdf');

    expect(returnedKey).toBe(key);
    expect(await provider.fileExists(key)).toBe(true);

    const savedBuffer = await provider.getFileBuffer(key);
    expect(savedBuffer.toString()).toBe('pdf test content');
  });

  it('should generate a valid signed download URL for an existing file', async () => {
    const key = 'document.pdf';
    await provider.save(Buffer.from('data'), key, 'application/pdf');

    const signedUrl = await provider.getSignedDownloadUrl(key, 900);
    expect(signedUrl).toContain(`/api/v1/files/raw/${key}`);
    expect(signedUrl).toContain('expires=');
    expect(signedUrl).toContain('sig=');

    // Parse query params
    const urlObj = new URL(`http://localhost${signedUrl}`);
    const expires = parseInt(urlObj.searchParams.get('expires') || '0', 10);
    const sig = urlObj.searchParams.get('sig') || '';

    expect(expires).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(provider.verifySignedUrl(key, expires, sig)).toBe(true);
  });

  it('should throw NotFoundError when generating signed URL for non-existent file', async () => {
    await expect(provider.getSignedDownloadUrl('missing.pdf')).rejects.toThrow(NotFoundError);
  });

  it('should reject expired signed URLs during verification', () => {
    const key = 'file.pdf';
    const pastExpires = Math.floor(Date.now() / 1000) - 100; // 100 seconds ago
    // Even if signature is generated correctly, it should fail verification due to expiration
    const providerAny = provider as unknown as {
      generateSignature: (k: string, exp: number) => string;
    };
    const sig = providerAny.generateSignature(key, pastExpires);

    expect(provider.verifySignedUrl(key, pastExpires, sig)).toBe(false);
  });

  it('should reject tampered signature in signed URL verification', async () => {
    const key = 'file.pdf';
    await provider.save(Buffer.from('data'), key, 'application/pdf');
    const futureExpires = Math.floor(Date.now() / 1000) + 900;

    const validSig = (
      provider as unknown as {
        generateSignature: (k: string, exp: number) => string;
      }
    ).generateSignature(key, futureExpires);

    // Tampered signature
    const tamperedSig = validSig.slice(0, -2) + 'ff';
    expect(provider.verifySignedUrl(key, futureExpires, tamperedSig)).toBe(false);

    // Tampered storageKey
    expect(provider.verifySignedUrl('other-file.pdf', futureExpires, validSig)).toBe(false);
  });

  it('should return a readable file stream for an existing file', async () => {
    const key = 'stream-test.txt';
    const content = 'Readable stream content';
    await provider.save(Buffer.from(content), key, 'text/plain');

    const stream = provider.getFileInputStream(key);
    expect(stream).toBeDefined();

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString()).toBe(content);
  });

  it('should throw NotFoundError when getting stream for non-existent file', () => {
    expect(() => provider.getFileInputStream('non-existent.txt')).toThrow(NotFoundError);
  });

  it('should delete a file from disk', async () => {
    const key = 'file-to-delete.pdf';
    await provider.save(Buffer.from('delete me'), key, 'application/pdf');

    expect(await provider.fileExists(key)).toBe(true);
    await provider.delete(key);
    expect(await provider.fileExists(key)).toBe(false);

    // Deleting non-existent file does not throw
    await expect(provider.delete(key)).resolves.toBeUndefined();
  });

  it('should prevent directory traversal attacks', () => {
    const internal = provider as unknown as {
      resolveSafePath: (k: string) => string;
    };
    jest.spyOn(path, 'resolve').mockReturnValueOnce('/etc/shadow');

    expect(() => internal.resolveSafePath('traversal-key')).toThrow(ValidationError);
  });
});
