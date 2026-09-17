import { PrismaClient, Prisma } from '@prisma/client';
import { PasswordHistoryService } from '../../../../src/modules/auth/infrastructure/password-history.service';
import { IHashProvider } from '../../../../src/shared/providers';
import { ValidationError } from '../../../../src/shared/errors';
import { PASSWORD_HISTORY_REUSE_ERROR } from '../../../../src/modules/auth/domain';

describe('PasswordHistoryService Unit Tests', () => {
  let mockPrisma: {
    passwordHistory: {
      findMany: jest.Mock;
      create: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let mockHashProvider: {
    hash: jest.Mock;
    verify: jest.Mock;
  };
  let service: PasswordHistoryService;

  beforeEach(() => {
    mockPrisma = {
      passwordHistory: {
        findMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    mockHashProvider = {
      hash: jest.fn(),
      verify: jest.fn(),
    };
    service = new PasswordHistoryService(
      mockPrisma as unknown as PrismaClient,
      mockHashProvider as unknown as IHashProvider,
    );
  });

  describe('assertNotReused', () => {
    it('should short-circuit and reject immediately if candidate password matches active current password', async () => {
      mockHashProvider.verify.mockResolvedValueOnce(true);

      await expect(
        service.assertNotReused('user-1', 'current-hash', 'CandidatePass123!'),
      ).rejects.toThrow(new ValidationError(PASSWORD_HISTORY_REUSE_ERROR));

      expect(mockHashProvider.verify).toHaveBeenCalledTimes(1);
      expect(mockHashProvider.verify).toHaveBeenCalledWith('current-hash', 'CandidatePass123!');
      // DB must not be queried when current password matches
      expect(mockPrisma.passwordHistory.findMany).not.toHaveBeenCalled();
    });

    it('should query up to 3 historical hashes and reject if candidate matches any historical hash', async () => {
      // Current password does not match
      mockHashProvider.verify.mockResolvedValueOnce(false);

      mockPrisma.passwordHistory.findMany.mockResolvedValueOnce([
        { passwordHash: 'hist-hash-1' },
        { passwordHash: 'hist-hash-2' },
        { passwordHash: 'hist-hash-3' },
      ]);

      // Historical matches: false for 1, true for 2, false for 3
      mockHashProvider.verify
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await expect(
        service.assertNotReused('user-1', 'current-hash', 'CandidatePass123!'),
      ).rejects.toThrow(new ValidationError(PASSWORD_HISTORY_REUSE_ERROR));

      expect(mockPrisma.passwordHistory.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { passwordHash: true },
      });
      // 1 active check + 3 historical checks in parallel
      expect(mockHashProvider.verify).toHaveBeenCalledTimes(4);
    });

    it('should pass cleanly if candidate password matches neither current nor any of the last 3 historical hashes', async () => {
      mockHashProvider.verify.mockResolvedValue(false);

      mockPrisma.passwordHistory.findMany.mockResolvedValueOnce([
        { passwordHash: 'hist-hash-1' },
        { passwordHash: 'hist-hash-2' },
      ]);

      await expect(
        service.assertNotReused('user-1', 'current-hash', 'CompletelyNewPass123!'),
      ).resolves.toBeUndefined();

      expect(mockHashProvider.verify).toHaveBeenCalledTimes(3);
    });

    it('should pass cleanly if user has no historical passwords and current password does not match', async () => {
      mockHashProvider.verify.mockResolvedValueOnce(false);
      mockPrisma.passwordHistory.findMany.mockResolvedValueOnce([]);

      await expect(
        service.assertNotReused('user-1', 'current-hash', 'CompletelyNewPass123!'),
      ).resolves.toBeUndefined();

      expect(mockHashProvider.verify).toHaveBeenCalledTimes(1);
    });
  });

  describe('archiveAndPrune', () => {
    let mockTx: {
      passwordHistory: {
        create: jest.Mock;
        findMany: jest.Mock;
        deleteMany: jest.Mock;
      };
    };

    beforeEach(() => {
      mockTx = {
        passwordHistory: {
          create: jest.fn().mockResolvedValue({ id: 'new-hist-id' }),
          findMany: jest.fn(),
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
    });

    it('should archive current hash and prune obsolete records beyond depth 3 with deterministic sorting', async () => {
      mockTx.passwordHistory.findMany.mockResolvedValueOnce([
        { id: 'obsolete-id-4' },
        { id: 'obsolete-id-5' },
      ]);

      await service.archiveAndPrune(
        mockTx as unknown as Prisma.TransactionClient,
        'user-1',
        'current-hash',
      );

      // Archival verification
      expect(mockTx.passwordHistory.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          passwordHash: 'current-hash',
        },
      });

      // Deterministic pruning query verification
      expect(mockTx.passwordHistory.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        skip: 3,
        select: { id: true },
      });

      // Deletion of obsolete records
      expect(mockTx.passwordHistory.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['obsolete-id-4', 'obsolete-id-5'] } },
      });
    });

    it('should not call deleteMany if history count does not exceed depth 3', async () => {
      mockTx.passwordHistory.findMany.mockResolvedValueOnce([]);

      await service.archiveAndPrune(
        mockTx as unknown as Prisma.TransactionClient,
        'user-1',
        'current-hash',
      );

      expect(mockTx.passwordHistory.create).toHaveBeenCalled();
      expect(mockTx.passwordHistory.findMany).toHaveBeenCalled();
      expect(mockTx.passwordHistory.deleteMany).not.toHaveBeenCalled();
    });
  });
});
