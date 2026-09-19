import { PrismaClient } from '@prisma/client';
import { UploadCvUseCase } from '../../../../src/modules/files/application/upload-cv.usecase';
import { FileValidatorService } from '../../../../src/modules/files/infrastructure/file-validator.service';
import { StorageProvider } from '../../../../src/modules/files/domain/storage-provider.interface';
import { NotFoundError, ValidationError } from '../../../../src/shared/errors';

describe('UploadCvUseCase Unit Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockValidator: jest.Mocked<FileValidatorService>;
  let mockStorage: jest.Mocked<StorageProvider>;
  let useCase: UploadCvUseCase;

  const mockDbMember = {
    id: 'member-1',
    userId: 'user-1',
    fullNameEn: 'Sarah Mahmoud',
    fullNameAr: 'سارة محمود',
    phone: '+201012345678',
    country: 'Egypt',
    city: 'Alexandria',
    yearsOfExperience: '2-5',
    areasOfExpertise: ['Product Design'],
    industriesServed: ['Healthcare'],
    languages: ['Arabic', 'English'],
    bioEn: 'Senior product designer.',
    bioAr: 'مصممة منتجات.',
    linkedinUrl: 'https://linkedin.com/in/sarah',
    photoFileId: null,
    directoryOptIn: true,
    profileCompletionRate: 91, // 10 out of 11 fields, missing CV
    user: {
      id: 'user-1',
      email: 'sarah@example.com',
    },
    files: [],
  };

  beforeEach(() => {
    const mockTx = {
      file: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({
          id: 'new-file-id-1',
          ownerId: 'member-1',
          category: 'CV',
          originalName: 'sarah-cv.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          status: 'ACTIVE',
          createdAt: new Date('2026-02-01'),
        }),
      },
      member: {
        update: jest.fn().mockResolvedValue({ id: 'member-1' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
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
    };

    useCase = new UploadCvUseCase(mockPrisma, mockValidator, mockStorage);
  });

  it('should successfully upload CV, supersede old files, recalculate completion rate (100%), and write AuditLog', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockDbMember);

    mockValidator.validateCv.mockReturnValue({
      mimeType: 'application/pdf',
      extension: 'pdf',
      sizeBytes: 2048,
    });

    mockStorage.save.mockResolvedValue('uuid-1234.pdf');

    const result = await useCase.execute(
      'user-1',
      {
        buffer: Buffer.from('%PDF-1.7 mock file content'),
        originalname: 'my-resume.pdf',
        size: 2048,
      },
      { ipAddress: '192.168.1.1', requestId: 'req-cv-1' },
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

    // Verify storage saved with non-guessable key and mimeType
    expect(mockStorage.save).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.stringMatching(/^[0-9a-f-]+\.pdf$/),
      'application/pdf',
    );

    // Verify previous active CVs superseded
    expect(mockTx.file.updateMany).toHaveBeenCalledWith({
      where: {
        ownerId: 'member-1',
        category: 'CV',
        status: 'ACTIVE',
      },
      data: expect.objectContaining({
        status: 'SUPERSEDED',
      }),
    });

    // Verify new file created with status ACTIVE
    expect(mockTx.file.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: 'member-1',
        category: 'CV',
        originalName: 'my-resume.pdf',
        storageKey: 'uuid-1234.pdf',
        mimeType: 'application/pdf',
        status: 'ACTIVE',
      }),
    });

    // Verify member completion rate updated to 100% (all 11 fields complete)
    expect(mockTx.member.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: {
        profileCompletionRate: 100,
      },
    });

    // Verify AuditLog written
    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'user-1',
        actorRole: 'MEMBER',
        action: 'CV_UPLOADED',
        resource: 'File',
        resourceId: 'new-file-id-1',
        ipAddress: '192.168.1.1',
        requestId: 'req-cv-1',
      }),
    });

    expect(result.file.id).toBe('new-file-id-1');
    expect(result.profileCompletionRate).toBe(100);
    expect(result.completionPercentage).toBe(100);
    expect(result.missingFields).toHaveLength(0);
  });

  it('should ensure existing CV remains untouched when validation fails (VAL-60 safe replacement)', async () => {
    mockValidator.validateCv.mockImplementation(() => {
      throw new ValidationError(
        'Invalid CV file format. Only PDF, DOC, and DOCX files verified by signature are accepted',
      );
    });

    await expect(
      useCase.execute('user-1', {
        buffer: Buffer.from('not-a-valid-cv'),
        originalname: 'script.exe',
        size: 500,
      }),
    ).rejects.toThrow(ValidationError);

    // Database and storage are NEVER touched
    expect(mockStorage.save).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.member.findUnique).not.toHaveBeenCalled();
  });

  it('should ensure existing CV remains untouched when storage persistence fails (VAL-60 safe replacement)', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockDbMember);

    mockValidator.validateCv.mockReturnValue({
      mimeType: 'application/pdf',
      extension: 'pdf',
      sizeBytes: 1024,
    });

    mockStorage.save.mockRejectedValue(new Error('Disk write I/O error'));

    await expect(
      useCase.execute('user-1', {
        buffer: Buffer.from('%PDF-1.5 test'),
        originalname: 'cv.pdf',
        size: 1024,
      }),
    ).rejects.toThrow('Disk write I/O error');

    // Database transaction was never started
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when member is not found', async () => {
    mockValidator.validateCv.mockReturnValue({
      mimeType: 'application/pdf',
      extension: 'pdf',
      sizeBytes: 1024,
    });

    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      useCase.execute('unknown-user', {
        buffer: Buffer.from('%PDF-1.4 test'),
        originalname: 'cv.pdf',
        size: 1024,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
