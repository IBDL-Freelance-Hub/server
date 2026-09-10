import { Prisma, PrismaClient } from '@prisma/client';
import { claimAssessmentCredential } from '../../../../src/modules/members/infrastructure/assessment-pool.service';
import { ingestAssessmentCredentials } from '../../../../src/modules/members/infrastructure/seed-assessment-credentials';

describe('Assessment Pool Service Unit Tests', () => {
  let mockTx: {
    assessmentCredentialPool: {
      findFirst: jest.Mock;
      update: jest.Mock;
      createMany: jest.Mock;
    };
  };

  beforeEach(() => {
    mockTx = {
      assessmentCredentialPool: {
        findFirst: jest.fn(),
        update: jest.fn(),
        createMany: jest.fn(),
      },
    };
  });

  describe('claimAssessmentCredential', () => {
    it('should claim available credential and assign it to userId', async () => {
      const mockCredential = {
        id: 'cred-1',
        username: 'assessment_user_101',
        password: 'SecretPassword123',
        accessUrl: 'https://assessment.ibdl.net/portal/101',
        status: 'AVAILABLE',
      };

      mockTx.assessmentCredentialPool.findFirst.mockResolvedValue(mockCredential);
      mockTx.assessmentCredentialPool.update.mockResolvedValue({
        ...mockCredential,
        status: 'ASSIGNED',
        assignedTo: 'user-123',
      });

      const result = await claimAssessmentCredential(
        mockTx as unknown as Prisma.TransactionClient,
        'user-123',
        'flh.fallback',
      );

      expect(result.username).toBe('assessment_user_101');
      expect(result.password).toBe('SecretPassword123');
      expect(result.accessUrl).toBe('https://assessment.ibdl.net/portal/101');
      expect(result.isPoolExhausted).toBe(false);

      expect(mockTx.assessmentCredentialPool.update).toHaveBeenCalledWith({
        where: { id: 'cred-1' },
        data: {
          status: 'ASSIGNED',
          assignedTo: 'user-123',
          assignedAt: expect.any(Date),
        },
      });
    });

    it('should return fallback credentials when pool is empty or exhausted', async () => {
      mockTx.assessmentCredentialPool.findFirst.mockResolvedValue(null);

      const result = await claimAssessmentCredential(
        mockTx as unknown as Prisma.TransactionClient,
        'user-999',
        'flh.marwa',
      );

      expect(result.username).toBe('flh.marwa');
      expect(result.password).toBe('ASSESSMENT-2026-DEMO');
      expect(result.accessUrl).toBe('https://assessment.ibdl.net/start');
      expect(result.isPoolExhausted).toBe(true);

      expect(mockTx.assessmentCredentialPool.update).not.toHaveBeenCalled();
    });
  });

  describe('ingestAssessmentCredentials', () => {
    it('should bulk insert credential records with skipDuplicates', async () => {
      const mockCreateMany = jest.fn().mockResolvedValue({ count: 2 });
      const mockPrisma = {
        assessmentCredentialPool: {
          createMany: mockCreateMany,
        },
      } as unknown as PrismaClient;

      const records = [
        { username: 'user1', password: 'pass1', accessUrl: 'link1' },
        { username: 'user2', password: 'pass2' },
      ];

      const result = await ingestAssessmentCredentials(records, mockPrisma);

      expect(result.count).toBe(2);
      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [
          { username: 'user1', password: 'pass1', accessUrl: 'link1', status: 'AVAILABLE' },
          { username: 'user2', password: 'pass2', accessUrl: null, status: 'AVAILABLE' },
        ],
        skipDuplicates: true,
      });
    });

    it('should return count 0 if records array is empty', async () => {
      const mockPrisma = {} as PrismaClient;
      const result = await ingestAssessmentCredentials([], mockPrisma);
      expect(result.count).toBe(0);
    });
  });
});
