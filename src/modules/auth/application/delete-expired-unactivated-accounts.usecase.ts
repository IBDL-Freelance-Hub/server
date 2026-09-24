import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';

export interface DeleteExpiredAccountsResult {
  accountsDeleted: number;
}

export class DeleteExpiredUnactivatedAccountsUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(): Promise<DeleteExpiredAccountsResult> {
    const config = await this.prisma.securityConfig.findFirst({ where: { id: 1 } });
    const retentionMonths = config?.unactivatedRetentionMonths ?? 12;

    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);

    const expiredUsers = await this.prisma.user.findMany({
      where: {
        status: 'UNACTIVATED',
        createdAt: {
          lt: cutoffDate,
        },
      },
      include: { member: true },
    });

    if (expiredUsers.length === 0) {
      return { accountsDeleted: 0 };
    }

    const userIds = expiredUsers.map((u) => u.id);
    const memberIds = expiredUsers.filter((u) => Boolean(u.member)).map((u) => u.member!.id);

    await this.prisma.$transaction(async (tx) => {
      // 1. Batch insert audit entries prior to deletion per BRU-187
      await tx.auditLog.createMany({
        data: expiredUsers.map((user) => ({
          actorId: user.id,
          action: 'UNACTIVATED_ACCOUNT_RETENTION_REMOVED',
          resource: 'User',
          resourceId: user.id,
          reason: 'unactivated_retention_period_exceeded',
          previousState: {
            email: user.email,
            createdAt: user.createdAt,
          },
        })),
      });

      // 2. Batch delete member records
      if (memberIds.length > 0) {
        await tx.member.deleteMany({
          where: { id: { in: memberIds } },
        });
      }

      // 3. Batch delete user records (cascades to VerificationTokens and Sessions)
      await tx.user.deleteMany({
        where: { id: { in: userIds } },
      });
    });

    return { accountsDeleted: expiredUsers.length };
  }
}
