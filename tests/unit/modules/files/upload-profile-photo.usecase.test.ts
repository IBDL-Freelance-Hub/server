import { PrismaClient } from '@prisma/client';
import { UploadProfilePhotoUseCase } from '../../../../src/modules/files/application/upload-profile-photo.usecase';
import { StorageProvider } from '../../../../src/modules/files/domain';
import { FileValidatorService } from '../../../../src/modules/files/infrastructure/file-validator.service';
import { NotFoundError, ValidationError } from '../../../../src/shared/errors';

describe('UploadProfilePhotoUseCase Unit Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockValidator: jest.Mocked<FileValidatorService>;
  let mockStorage: jest.Mocked<StorageProvider>;
  let useCase: UploadProfilePhotoUseCase;

  const mockDbMember = {
    id: 'member-photo-1',
    userId: 'user-photo-1',
    photoFileId: 'old-photo-id',
  };

  beforeEach(() => {
    const mockTx = {
      file: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({
          id: 'new-photo-file-id',
          ownerId: 'member-photo-1',
          category: 'PROFILE_PHOTO',
          originalName: 'avatar.png',
          mimeType: 'image/png',
          sizeBytes: 1024,
          status: 'ACTIVE',
          createdAt: new Date('2026-03-01'),
        }),
      },
      member: {
        update: jest.fn().mockResolvedValue({ id: 'member-photo-1' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-photo' }),
      },
    };

    mockPrisma = {
      member: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
    } as unknown as jest.Mocked<PrismaClient>;

    (mockPrisma as unknown as { _mockTx: typeof mockTx })._mockTx = mockTx;

    mockValidator = {
      validateCv: jest.fn(),
      validateProfilePhoto: jest.fn(),
    } as unknown as jest.Mocked<FileValidatorService>;

    mockStorage = {
      save: jest.fn(),
      getSignedDownloadUrl: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<StorageProvider>;

    useCase = new UploadProfilePhotoUseCase(mockPrisma, mockValidator, mockStorage);
  });

  it('should successfully upload profile photo, supersede old photos, update photoFileId, and write AuditLog', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockDbMember);

    mockValidator.validateProfilePhoto.mockReturnValue({
      mimeType: 'image/png',
      extension: 'png',
      sizeBytes: 4096,
    });

    mockStorage.save.mockResolvedValue('photo-uuid-456.png');

    const result = await useCase.execute(
      'user-photo-1',
      {
        buffer: Buffer.from('mock png buffer'),
        originalname: 'profile-picture.png',
        size: 4096,
      },
      { ipAddress: '10.0.0.1', requestId: 'req-photo-1' },
    );

    const mockTx = (
      mockPrisma as unknown as {
        _mockTx: {
          file: { updateMany: jest.Mock; create: jest.Mock };
          member: { update: jest.Mock };
          auditLog: { create: jest.Mock };
        };
      }
    )._mockTx;

    // Verify storage saved with non-guessable key
    expect(mockStorage.save).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.stringMatching(/^[0-9a-f-]+\.png$/),
      'image/png',
    );

    // Verify previous active photos superseded
    expect(mockTx.file.updateMany).toHaveBeenCalledWith({
      where: {
        ownerId: 'member-photo-1',
        category: 'PROFILE_PHOTO',
        status: 'ACTIVE',
      },
      data: expect.objectContaining({
        status: 'SUPERSEDED',
      }),
    });

    // Verify new file created with status ACTIVE
    expect(mockTx.file.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: 'member-photo-1',
        category: 'PROFILE_PHOTO',
        originalName: 'profile-picture.png',
        storageKey: 'photo-uuid-456.png',
        mimeType: 'image/png',
        status: 'ACTIVE',
      }),
    });

    // Verify Member.photoFileId updated
    expect(mockTx.member.update).toHaveBeenCalledWith({
      where: { id: 'member-photo-1' },
      data: {
        photoFileId: 'new-photo-file-id',
      },
    });

    // Verify AuditLog written
    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'user-photo-1',
        actorRole: 'MEMBER',
        action: 'PROFILE_PHOTO_UPLOADED',
        resource: 'File',
        resourceId: 'new-photo-file-id',
        ipAddress: '10.0.0.1',
        requestId: 'req-photo-1',
      }),
    });

    expect(result.file.id).toBe('new-photo-file-id');
    expect(result.photoFileId).toBe('new-photo-file-id');
  });

  it('should reject invalid photo format before database is queried', async () => {
    mockValidator.validateProfilePhoto.mockImplementation(() => {
      throw new ValidationError('Invalid profile photo format');
    });

    await expect(
      useCase.execute('user-photo-1', {
        buffer: Buffer.from('bad data'),
        originalname: 'photo.exe',
        size: 100,
      }),
    ).rejects.toThrow(ValidationError);

    expect(mockPrisma.member.findUnique).not.toHaveBeenCalled();
    expect(mockStorage.save).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError if member profile is not found', async () => {
    mockValidator.validateProfilePhoto.mockReturnValue({
      mimeType: 'image/jpeg',
      extension: 'jpg',
      sizeBytes: 1024,
    });

    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      useCase.execute('unknown-user', {
        buffer: Buffer.from('jpeg buffer'),
        originalname: 'pic.jpg',
        size: 1024,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
