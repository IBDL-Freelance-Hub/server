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

    let remindersSent = 0;

    for (const user of targetUsers) {
      // Check if reminder was already sent for this user
      const existingReminder = await this.prisma.auditLog.findFirst({
        where: {
          action: 'UNACTIVATED_ACCOUNT_REMINDER_SENT',
          resourceId: user.id,
        },
      });

      if (!existingReminder) {
        // Dispatch warning email notification
        // TODO(notifications): Send reminder email to user.email

        await this.prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: 'UNACTIVATED_ACCOUNT_REMINDER_SENT',
            resource: 'User',
            resourceId: user.id,
            reason: 'unactivated_retention_warning',
          },
        });

        remindersSent += 1;
      }
    }

    return { remindersSent };
  }
}
