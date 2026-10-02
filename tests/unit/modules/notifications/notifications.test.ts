import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { GetNotificationsUseCase } from '../../../../src/modules/notifications/application/get-notifications.usecase';
import { MarkNotificationReadUseCase } from '../../../../src/modules/notifications/application/mark-notification-read.usecase';
import { MarkAllNotificationsReadUseCase } from '../../../../src/modules/notifications/application/mark-all-notifications-read.usecase';
import { NotificationsController } from '../../../../src/modules/notifications/presentation/notifications.controller';
import { notificationIdParamSchema } from '../../../../src/modules/notifications/presentation/notifications.schema';
import { AuthenticationError, NotFoundError } from '../../../../src/shared/errors';

describe('Notifications Module Unit & Integration Tests', () => {
  const currentUserId = 'user-uuid-1111';
  const otherUserId = 'user-uuid-2222';
  const notificationId = 'a0000000-0000-0000-0000-000000000001';
  const otherNotificationId = 'b0000000-0000-0000-0000-000000000002';

  const mockDate1 = new Date('2026-03-01T12:00:00.000Z');
  const mockDate2 = new Date('2026-03-01T10:00:00.000Z');

  const mockNotification1 = {
    id: notificationId,
    userId: currentUserId,
    titleEn: 'Request Approved',
    titleAr: 'تمت الموافقة على الطلب',
    bodyEn: 'Your request has been approved.',
    bodyAr: 'تمت الموافقة على طلبك بنجاح.',
    type: 'REQUEST_APPROVED',
    isRead: false,
    link: '/requests/REQ-2026-0001',
    createdAt: mockDate1,
  };

  const mockNotification2 = {
    id: 'a0000000-0000-0000-0000-000000000002',
    userId: currentUserId,
    titleEn: 'Information Requested',
    titleAr: 'مطلوب معلومات إضافية',
    bodyEn: 'Please provide extra details.',
    bodyAr: 'يرجى تقديم تفاصيل إضافية.',
    type: 'REQUEST_INFO_REQUESTED',
    isRead: true,
    link: '/requests/REQ-2026-0002',
    createdAt: mockDate2,
  };

  const mockOtherUserNotification = {
    id: otherNotificationId,
    userId: otherUserId,
    titleEn: 'Other User Request Approved',
    titleAr: 'تمت الموافقة على طلب مستخدم آخر',
    bodyEn: 'Confidential notification for other user',
    bodyAr: 'إشعار سري لمستخدم آخر',
    type: 'REQUEST_APPROVED',
    isRead: false,
    link: '/requests/REQ-2026-9999',
    createdAt: mockDate1,
  };

  describe('1. Application Use Cases', () => {
    let mockPrisma: jest.Mocked<PrismaClient>;

    beforeEach(() => {
      mockPrisma = {
        notification: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          count: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
        },
      } as unknown as jest.Mocked<PrismaClient>;
    });

    describe('GetNotificationsUseCase', () => {
      it('should return notifications sorted by createdAt DESC and calculate exact unreadCount', async () => {
        (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue([
          mockNotification1,
          mockNotification2,
        ]);
        (mockPrisma.notification.count as jest.Mock).mockResolvedValue(1);

        const useCase = new GetNotificationsUseCase(mockPrisma);
        const result = await useCase.execute(currentUserId);

        expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
          where: { userId: currentUserId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });

        expect(mockPrisma.notification.count).toHaveBeenCalledWith({
          where: { userId: currentUserId, isRead: false },
        });

        expect(result.unreadCount).toBe(1);
        expect(result.notifications).toHaveLength(2);
        expect(result.notifications[0]).toEqual({
          id: mockNotification1.id,
          titleEn: mockNotification1.titleEn,
          titleAr: mockNotification1.titleAr,
          bodyEn: mockNotification1.bodyEn,
          bodyAr: mockNotification1.bodyAr,
          type: mockNotification1.type,
          isRead: false,
          link: mockNotification1.link,
          createdAt: mockDate1.toISOString(),
        });
      });

      it('should enforce user isolation: never return notifications of another user', async () => {
        (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue([]);
        (mockPrisma.notification.count as jest.Mock).mockResolvedValue(0);

        const useCase = new GetNotificationsUseCase(mockPrisma);
        await useCase.execute(currentUserId);

        // Verification: query filter MUST be scoped strictly to currentUserId
        expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { userId: currentUserId },
          }),
        );
        expect(mockPrisma.notification.count).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { userId: currentUserId, isRead: false },
          }),
        );
      });
    });

    describe('MarkNotificationReadUseCase', () => {
      it('should mark a specific notification as isRead: true for the owning user', async () => {
        (mockPrisma.notification.findUnique as jest.Mock).mockResolvedValue(mockNotification1);
        (mockPrisma.notification.update as jest.Mock).mockResolvedValue({
          ...mockNotification1,
          isRead: true,
        });

        const useCase = new MarkNotificationReadUseCase(mockPrisma);
        await useCase.execute(currentUserId, notificationId);

        expect(mockPrisma.notification.findUnique).toHaveBeenCalledWith({
          where: { id: notificationId },
        });

        expect(mockPrisma.notification.update).toHaveBeenCalledWith({
          where: { id: notificationId },
          data: { isRead: true },
        });
      });

      it('should enforce user isolation: throw NotFoundError (404) if notification belongs to another user', async () => {
        (mockPrisma.notification.findUnique as jest.Mock).mockResolvedValue(
          mockOtherUserNotification,
        );

        const useCase = new MarkNotificationReadUseCase(mockPrisma);

        await expect(useCase.execute(currentUserId, otherNotificationId)).rejects.toThrow(
          NotFoundError,
        );

        expect(mockPrisma.notification.update).not.toHaveBeenCalled();
      });

      it('should throw NotFoundError (404) if notification does not exist', async () => {
        (mockPrisma.notification.findUnique as jest.Mock).mockResolvedValue(null);

        const useCase = new MarkNotificationReadUseCase(mockPrisma);

        await expect(
          useCase.execute(currentUserId, '00000000-0000-0000-0000-000000000000'),
        ).rejects.toThrow(NotFoundError);

        expect(mockPrisma.notification.update).not.toHaveBeenCalled();
      });
    });

    describe('MarkAllNotificationsReadUseCase', () => {
      it('should mark all unread notifications of the current user as read in bulk', async () => {
        (mockPrisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 5 });

        const useCase = new MarkAllNotificationsReadUseCase(mockPrisma);
        await useCase.execute(currentUserId);

        expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
          where: { userId: currentUserId, isRead: false },
          data: { isRead: true },
        });
      });

      it('should strictly isolate bulk update to the authenticated user ID', async () => {
        (mockPrisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

        const useCase = new MarkAllNotificationsReadUseCase(mockPrisma);
        await useCase.execute(currentUserId);

        expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
          where: { userId: currentUserId, isRead: false },
          data: { isRead: true },
        });
      });
    });
  });

  describe('2. Presentation Layer (NotificationsController)', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: jest.MockedFunction<NextFunction>;

    let mockGetNotificationsUseCase: jest.Mocked<GetNotificationsUseCase>;
    let mockMarkNotificationReadUseCase: jest.Mocked<MarkNotificationReadUseCase>;
    let mockMarkAllNotificationsReadUseCase: jest.Mocked<MarkAllNotificationsReadUseCase>;
    let controller: NotificationsController;

    beforeEach(() => {
      mockReq = {
        headers: {},
        params: {},
        query: {},
        body: {},
        user: {
          id: currentUserId,
          email: 'member@example.com',
          userType: 'MEMBER',
          status: 'ACTIVE',
          memberId: 'member-1',
          sessionId: 'session-1',
          staffRole: null,
          member: null,
        },
      };

      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      mockNext = jest.fn();

      mockGetNotificationsUseCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<GetNotificationsUseCase>;

      mockMarkNotificationReadUseCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<MarkNotificationReadUseCase>;

      mockMarkAllNotificationsReadUseCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<MarkAllNotificationsReadUseCase>;

      controller = new NotificationsController(
        mockGetNotificationsUseCase,
        mockMarkNotificationReadUseCase,
        mockMarkAllNotificationsReadUseCase,
      );
    });

    describe('GET /api/v1/notifications', () => {
      it('should return 200 with notifications list and exact unreadCount', async () => {
        const payload = {
          notifications: [
            {
              id: mockNotification1.id,
              titleEn: mockNotification1.titleEn,
              titleAr: mockNotification1.titleAr,
              bodyEn: mockNotification1.bodyEn,
              bodyAr: mockNotification1.bodyAr,
              type: mockNotification1.type,
              isRead: false,
              link: mockNotification1.link,
              createdAt: mockDate1.toISOString(),
            },
          ],
          unreadCount: 1,
        };

        mockGetNotificationsUseCase.execute.mockResolvedValue(payload);

        await controller.getNotifications(mockReq as Request, mockRes as Response, mockNext);

        expect(mockGetNotificationsUseCase.execute).toHaveBeenCalledWith(currentUserId);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: payload.notifications,
          unreadCount: 1,
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should fail with AuthenticationError if req.user is missing', async () => {
        delete mockReq.user;

        await controller.getNotifications(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
        expect(mockGetNotificationsUseCase.execute).not.toHaveBeenCalled();
      });
    });

    describe('PATCH /api/v1/notifications/:id/read', () => {
      it('should mark single notification as read and return 200', async () => {
        mockReq.params = { id: notificationId };
        mockMarkNotificationReadUseCase.execute.mockResolvedValue(undefined);

        await controller.markAsRead(mockReq as Request, mockRes as Response, mockNext);

        expect(mockMarkNotificationReadUseCase.execute).toHaveBeenCalledWith(
          currentUserId,
          notificationId,
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          message: 'Notification marked as read.',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should propagate NotFoundError to next handler when marking unauthorized/non-existent notification', async () => {
        mockReq.params = { id: otherNotificationId };
        mockMarkNotificationReadUseCase.execute.mockRejectedValue(
          new NotFoundError('Notification not found'),
        );

        await controller.markAsRead(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
      });

      it('should fail with AuthenticationError if req.user is missing', async () => {
        delete mockReq.user;
        mockReq.params = { id: notificationId };

        await controller.markAsRead(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      });
    });

    describe('PATCH /api/v1/notifications/read-all', () => {
      it('should mark all notifications as read in bulk and return 200', async () => {
        mockMarkAllNotificationsReadUseCase.execute.mockResolvedValue(undefined);

        await controller.markAllAsRead(mockReq as Request, mockRes as Response, mockNext);

        expect(mockMarkAllNotificationsReadUseCase.execute).toHaveBeenCalledWith(currentUserId);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          message: 'All notifications marked as read.',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should fail with AuthenticationError if req.user is missing', async () => {
        delete mockReq.user;

        await controller.markAllAsRead(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      });
    });
  });

  describe('3. Schema Validation (notificationIdParamSchema)', () => {
    it('should accept valid UUID identifier', () => {
      const parsed = notificationIdParamSchema.safeParse({ id: notificationId });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.id).toBe(notificationId);
      }
    });

    it('should reject non-UUID identifiers', () => {
      const parsed = notificationIdParamSchema.safeParse({ id: 'not-a-uuid-123' });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.errors[0]?.message).toBe('Invalid notification ID');
      }
    });

    it('should reject empty identifier', () => {
      const parsed = notificationIdParamSchema.safeParse({ id: '' });
      expect(parsed.success).toBe(false);
    });
  });
});
