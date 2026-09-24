import { PrismaClient } from '@prisma/client';
import { SendUnactivatedAccountRemindersUseCase } from '../../../../src/modules/auth/application/send-unactivated-account-reminders.usecase';
import { DeleteExpiredUnactivatedAccountsUseCase } from '../../../../src/modules/auth/application/delete-expired-unactivated-accounts.usecase';

describe('Unactivated Account Retention Jobs Unit Tests (Two-Job Architecture)', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      securityConfig: {
        findFirst: jest.fn().mockResolvedValue({
          unactivatedRetentionMonths: 12,
          unactivatedReminderDaysBeforeCutoff: 7,
        }),
      },
      user: {
        findMany: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      member: {
        delete: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    } as unknown as jest.Mocked<PrismaClient>;
  });

  describe('SendUnactivatedAccountRemindersUseCase', () => {
    it('should find accounts in warning window and create UNACTIVATED_ACCOUNT_REMINDER_SENT audit log via batch query', async () => {
      const mockUsers = [{ id: 'user-warn-1', email: 'warn1@example.com', status: 'UNACTIVATED' }];

      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

      const useCase = new SendUnactivatedAccountRemindersUseCase(mockPrisma);
      const result = await useCase.execute();

      expect(result.remindersSent).toBe(1);
      expect(mockPrisma.auditLog.createMany).toHaveBeenCalledWith({
        data: [
          {
            actorId: 'user-warn-1',
            action: 'UNACTIVATED_ACCOUNT_REMINDER_SENT',
            resource: 'User',
            resourceId: 'user-warn-1',
            reason: 'unactivated_retention_warning',
          },
        ],
      });
    });
  });

  describe('DeleteExpiredUnactivatedAccountsUseCase', () => {
    it('should delete unactivated accounts past 12-month cutoff and create UNACTIVATED_ACCOUNT_RETENTION_REMOVED audit log per BRU-187 via batch query', async () => {
      const mockExpiredUsers = [
        {
          id: 'user-expired-1',
          email: 'expired1@example.com',
          status: 'UNACTIVATED',
          createdAt: new Date('2025-01-01'),
          member: { id: 'member-expired-1' },
        },
      ];

      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue(mockExpiredUsers);

      const useCase = new DeleteExpiredUnactivatedAccountsUseCase(mockPrisma);
      const result = await useCase.execute();

      expect(result.accountsDeleted).toBe(1);
      expect(mockPrisma.auditLog.createMany).toHaveBeenCalledWith({
        data: [
          {
            actorId: 'user-expired-1',
            action: 'UNACTIVATED_ACCOUNT_RETENTION_REMOVED',
            resource: 'User',
            resourceId: 'user-expired-1',
            reason: 'unactivated_retention_period_exceeded',
            previousState: {
              email: 'expired1@example.com',
              createdAt: expect.any(Date),
            },
          },
        ],
      });
      expect(mockPrisma.member.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['member-expired-1'] } },
      });
      expect(mockPrisma.user.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['user-expired-1'] } },
      });
    });
  });
});
