import { PrismaClient, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../../shared/providers/prisma.provider';
import {
  IEmailProvider,
  emailProvider as defaultEmailProvider,
} from '../../../../shared/providers/email.provider';

export interface InAppNotification {
  id: string;
  userId: string;
  referenceCode: string;
  type: string;
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  link?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  isRead: boolean;
}

export interface SendRequestNotificationInput {
  userId: string;
  memberEmail?: string;
  referenceCode: string;
  type: string;
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export interface IRequestNotificationService {
  dispatchNotification(input: SendRequestNotificationInput): Promise<InAppNotification>;
  dispatchEmailOnly(input: SendRequestNotificationInput): Promise<void>;
  saveInAppNotification(
    tx: Prisma.TransactionClient,
    input: SendRequestNotificationInput,
  ): Promise<string>;
  getInAppNotificationsForUser(userId: string): Promise<InAppNotification[]>;
}

export class RequestNotificationService implements IRequestNotificationService {
  private static notificationsStore: InAppNotification[] = [];

  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly emailSvc: IEmailProvider = defaultEmailProvider,
  ) {}

  async dispatchNotification(input: SendRequestNotificationInput): Promise<InAppNotification> {
    const link = input.link || `/requests/${input.referenceCode}`;

    let persistedNotificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 1. Persist notification in PostgreSQL (Prisma Notification model)
    try {
      const persisted = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          titleEn: input.titleEn,
          titleAr: input.titleAr,
          bodyEn: input.messageEn,
          bodyAr: input.messageAr,
          type: input.type,
          isRead: false,
          link,
        },
      });
      persistedNotificationId = persisted.id;
    } catch (dbErr) {
      console.error('[RequestNotificationService] Failed to persist notification in DB:', dbErr);
    }

    const notification: InAppNotification = {
      id: persistedNotificationId,
      userId: input.userId,
      referenceCode: input.referenceCode,
      type: input.type,
      titleEn: input.titleEn,
      titleAr: input.titleAr,
      messageEn: input.messageEn,
      messageAr: input.messageAr,
      link,
      metadata: input.metadata,
      createdAt: new Date(),
      isRead: false,
    };

    RequestNotificationService.notificationsStore.unshift(notification);
    if (RequestNotificationService.notificationsStore.length > 500) {
      RequestNotificationService.notificationsStore.pop();
    }

    // 2. Dispatch email notification to member's verified email
    if (input.memberEmail) {
      try {
        await this.emailSvc.sendEmail({
          to: input.memberEmail,
          subject: `[IBDL Hub] ${input.titleEn} / ${input.titleAr}`,
          html: `<div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <p><strong>Reference:</strong> ${input.referenceCode}</p>
            <p>${input.messageEn}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 16px 0;" />
            <p dir="rtl">${input.messageAr}</p>
          </div>`,
        });
      } catch (err) {
        // Notification emails fail gracefully without interrupting admin state transition
        console.error('[RequestNotificationService] Failed to send email notification:', err);
      }
    }

    return notification;
  }

  async saveInAppNotification(
    tx: Prisma.TransactionClient,
    input: SendRequestNotificationInput,
  ): Promise<string> {
    const link = input.link || `/requests/${input.referenceCode}`;
    const persisted = await tx.notification.create({
      data: {
        userId: input.userId,
        titleEn: input.titleEn,
        titleAr: input.titleAr,
        bodyEn: input.messageEn,
        bodyAr: input.messageAr,
        type: input.type,
        isRead: false,
        link,
      },
    });
    return persisted.id;
  }

  async dispatchEmailOnly(input: SendRequestNotificationInput): Promise<void> {
    if (input.memberEmail) {
      try {
        await this.emailSvc.sendEmail({
          to: input.memberEmail,
          subject: `[IBDL Hub] ${input.titleEn} / ${input.titleAr}`,
          html: `<div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <p><strong>Reference:</strong> ${input.referenceCode}</p>
            <p>${input.messageEn}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 16px 0;" />
            <p dir="rtl">${input.messageAr}</p>
          </div>`,
        });
      } catch (err) {
        console.error('[RequestNotificationService] Failed to send email notification:', err);
      }
    }
  }

  async getInAppNotificationsForUser(userId: string): Promise<InAppNotification[]> {
    try {
      const rows = await this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      if (rows.length > 0) {
        return rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          referenceCode: '',
          type: r.type,
          titleEn: r.titleEn,
          titleAr: r.titleAr,
          messageEn: r.bodyEn,
          messageAr: r.bodyAr,
          link: r.link,
          createdAt: r.createdAt,
          isRead: r.isRead,
        }));
      }
    } catch {
      // Fall back to in-memory store
    }
    return RequestNotificationService.notificationsStore.filter((n) => n.userId === userId);
  }

  static clearStore(): void {
    RequestNotificationService.notificationsStore = [];
  }
}

export const requestNotificationService = new RequestNotificationService();
