import { PrismaClient } from '@prisma/client';
import { DeleteProfilePhotoUseCase } from '../../../../src/modules/files/application/delete-profile-photo.usecase';
import { NotFoundError } from '../../../../src/shared/errors';

describe('DeleteProfilePhotoUseCase Unit Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let useCase: DeleteProfilePhotoUseCase;

  const mockDbMember = {
    id: 'member-photo-1',
    userId: 'user-photo-1',
    photoFileId: 'current-photo-id',
  };

  beforeEach(() => {
    const mockTx = {
      file: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      member: {
        update: jest.fn().mockResolvedValue({ id: 'member-photo-1', photoFileId: null }),
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

    useCase = new DeleteProfilePhotoUseCase(mockPrisma);
  });

  it('should throw NotFoundError if member profile does not exist', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(useCase.execute('unknown-user')).rejects.toThrow(NotFoundError);
  });

  it('should supersede active photos, set photoFileId to null, and write AuditLog', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockDbMember);

    const result = await useCase.execute('user-photo-1', {
      ipAddress: '127.0.0.1',
      requestId: 'req-del-photo-1',
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Profile photo removed successfully');

    const tx = (
      mockPrisma as unknown as {
        _mockTx: {
          file: { updateMany: jest.Mock };
          member: { update: jest.Mock };
          auditLog: { create: jest.Mock };
        };
      }
    )._mockTx;

    expect(tx.file.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerId: 'member-photo-1',
          category: 'PROFILE_PHOTO',
          status: 'ACTIVE',
        },
        data: expect.objectContaining({
          status: 'SUPERSEDED',
        }),
      }),
    );

    expect(tx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'member-photo-1' },
        data: { photoFileId: null },
      }),
    );

    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'user-photo-1',
          action: 'PROFILE_PHOTO_REMOVED',
          resource: 'Member',
          resourceId: 'member-photo-1',
          previousState: { photoFileId: 'current-photo-id' },
          newState: { photoFileId: null },
        }),
      }),
    );
  });
});
