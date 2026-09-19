import { PrismaClient } from '@prisma/client';
import { DownloadFileUseCase } from '../../../../src/modules/files/application/download-file.usecase';
import { StorageProvider } from '../../../../src/modules/files/domain/storage-provider.interface';
import { NotFoundError } from '../../../../src/shared/errors';

describe('DownloadFileUseCase Unit Tests (SEC-32, ERR-98)', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockStorage: jest.Mocked<StorageProvider>;
  let useCase: DownloadFileUseCase;

  const mockFileRecord = {
    id: 'file-doc-123',
    ownerId: 'member-owner-id',
    category: 'CV',
    originalName: 'verified-cv.pdf',
    storageKey: 'uuid-secure-key.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 15360,
    status: 'ACTIVE',
  };

  beforeEach(() => {
    mockPrisma = {
      file: {
        findUnique: jest.fn(),
      },
      member: {
        findUnique: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;

    mockStorage = {
      save: jest.fn(),
      getSignedDownloadUrl: jest.fn(),
      delete: jest.fn(),
    };

    useCase = new DownloadFileUseCase(mockPrisma, mockStorage);
  });

  it('should successfully allow member to download their own file with signed URL', async () => {
    (mockPrisma.file.findUnique as jest.Mock).mockResolvedValue(mockFileRecord);
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-owner-id',
    });

    const expectedSignedUrl = '/api/v1/files/raw/uuid-secure-key.pdf?expires=12345&sig=abc';
    mockStorage.getSignedDownloadUrl.mockResolvedValue(expectedSignedUrl);

    const result = await useCase.execute('file-doc-123', 'user-owner-id', 'MEMBER');

    expect(mockPrisma.file.findUnique).toHaveBeenCalledWith({
      where: { id: 'file-doc-123' },
    });

    expect(mockPrisma.member.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-owner-id' },
      select: { id: true },
    });

    expect(mockStorage.getSignedDownloadUrl).toHaveBeenCalledWith('uuid-secure-key.pdf', undefined);
    expect(result.file.originalName).toBe('verified-cv.pdf');
    expect(result.file.mimeType).toBe('application/pdf');
    expect(result.downloadUrl).toBe(expectedSignedUrl);
  });

  it('should refuse unauthorized member with 404 Not Found (SEC-32, ERR-98 zero-trust)', async () => {
    (mockPrisma.file.findUnique as jest.Mock).mockResolvedValue(mockFileRecord);
    // Requester is member-attacker-id, while file owner is member-owner-id
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-attacker-id',
    });

    // Zero-trust: Must throw NotFoundError (404), never 403 Forbidden or reveal existence
    await expect(useCase.execute('file-doc-123', 'user-attacker-id', 'MEMBER')).rejects.toThrow(
      NotFoundError,
    );

    await expect(useCase.execute('file-doc-123', 'user-attacker-id', 'MEMBER')).rejects.toThrow(
      'File not found',
    );

    // Storage provider is NEVER accessed when ownership verification fails
    expect(mockStorage.getSignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('should return 404 when file does not exist in database', async () => {
    (mockPrisma.file.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(useCase.execute('non-existent-file', 'user-1', 'MEMBER')).rejects.toThrow(
      NotFoundError,
    );
    await expect(useCase.execute('non-existent-file', 'user-1', 'MEMBER')).rejects.toThrow(
      'File not found',
    );
    expect(mockStorage.getSignedDownloadUrl).not.toHaveBeenCalled();
  });
});
