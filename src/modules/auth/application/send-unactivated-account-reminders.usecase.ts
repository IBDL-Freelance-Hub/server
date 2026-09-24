import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';

export interface SendRemindersResult {
  remindersSent: number;
}

export class SendUnactivatedAccountRemindersUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(): Promise<SendRemindersResult> {
    const config = await this.prisma.securityConfig.findFirst({ where: { id: 1 } });
    const retentionMonths = config?.unactivatedRetentionMonths ?? 12;
    const reminderDaysBeforeCutoff = config?.unactivatedReminderDaysBeforeCutoff ?? 7;

    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);

    // Accounts approaching deletion window (between cutoffDate and cutoffDate + reminderDays)
    const reminderWindowEnd = new Date(
      cutoffDate.getTime() + reminderDaysBeforeCutoff * 24 * 60 * 60 * 1000,
    );

    const targetUsers = await this.prisma.user.findMany({
      where: {
        status: 'UNACTIVATED',
        createdAt: {
          gte: cutoffDate,
          lte: reminderWindowEnd,
        },
      },
    });

    if (targetUsers.length === 0) {
      return { remindersSent: 0 };
    }

    // 1. Batch query existing reminders for all target users in a single query
    const targetUserIds = targetUsers.map((u) => u.id);
    const existingReminders = await this.prisma.auditLog.findMany({
      where: {
        action: 'UNACTIVATED_ACCOUNT_REMINDER_SENT',
        resourceId: { in: targetUserIds },
      },
      select: { resourceId: true },
    });

    const alreadyRemindedSet = new Set(
      existingReminders.map((r) => r.resourceId).filter(Boolean) as string[],
    );

    const usersToRemind = targetUsers.filter((u) => !alreadyRemindedSet.has(u.id));

    if (usersToRemind.length > 0) {
      // Dispatch warning email notifications
      // TODO(notifications): Send reminder emails to users in queue/batch

      // 2. Batch insert audit log records
      await this.prisma.auditLog.createMany({
        data: usersToRemind.map((user) => ({
          actorId: user.id,
          action: 'UNACTIVATED_ACCOUNT_REMINDER_SENT',
          resource: 'User',
          resourceId: user.id,
          reason: 'unactivated_retention_warning',
        })),
      });
    }

    return { remindersSent: usersToRemind.length };
  }
}
