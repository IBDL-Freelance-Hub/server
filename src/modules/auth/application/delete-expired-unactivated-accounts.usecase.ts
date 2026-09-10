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

    let accountsDeleted = 0;

    for (const user of expiredUsers) {
      await this.prisma.$transaction(async (tx) => {
        // Log audit entry per BRU-187 prior to record deletion/anonymization
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'UNACTIVATED_ACCOUNT_RETENTION_REMOVED',
            resource: 'User',
            resourceId: user.id,
            reason: 'unactivated_retention_period_exceeded',
            previousState: {
              email: user.email,
              createdAt: user.createdAt,
            },
          },
        });

        // Delete user (cascades to VerificationTokens and Sessions; Member set to onDelete Restrict or cleaned up)
        if (user.member) {
          await tx.member.delete({
            where: { id: user.member.id },
          });
        }

        await tx.user.delete({
          where: { id: user.id },
        });
      });

      accountsDeleted += 1;
    }

    return { accountsDeleted };
  }
}
