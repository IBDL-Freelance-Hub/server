import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';

export class MarkAllNotificationsReadUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
