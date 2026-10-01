import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';

export interface GetNotificationsResult {
  notifications: Array<{
    id: string;
    titleEn: string;
    titleAr: string;
    bodyEn: string;
    bodyAr: string;
    type: string;
    isRead: boolean;
    link: string | null;
    createdAt: string;
  }>;
  unreadCount: number;
}

export class GetNotificationsUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(userId: string): Promise<GetNotificationsResult> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to recent 50 for performance
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        titleEn: n.titleEn,
        titleAr: n.titleAr,
        bodyEn: n.bodyEn,
        bodyAr: n.bodyAr,
        type: n.type,
        isRead: n.isRead,
        link: n.link,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    };
  }
}
