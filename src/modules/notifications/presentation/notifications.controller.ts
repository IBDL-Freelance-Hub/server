import { Request, Response, NextFunction } from 'express';
import { GetNotificationsUseCase } from '../application/get-notifications.usecase';
import { MarkNotificationReadUseCase } from '../application/mark-notification-read.usecase';
import { MarkAllNotificationsReadUseCase } from '../application/mark-all-notifications-read.usecase';
import { AuthenticationError } from '../../../shared/errors';

export class NotificationsController {
  constructor(
    private readonly getNotificationsUseCase: GetNotificationsUseCase = new GetNotificationsUseCase(),
    private readonly markNotificationReadUseCase: MarkNotificationReadUseCase = new MarkNotificationReadUseCase(),
    private readonly markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase = new MarkAllNotificationsReadUseCase(),
  ) {}

  getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required to view notifications.');
      }

      const result = await this.getNotificationsUseCase.execute(req.user.id);

      res.status(200).json({
        success: true,
        data: result.notifications,
        unreadCount: result.unreadCount,
      });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required.');
      }

      const id = req.params['id'] as string;
      await this.markNotificationReadUseCase.execute(req.user.id, id);

      res.status(200).json({
        success: true,
        message: 'Notification marked as read.',
      });
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required.');
      }

      await this.markAllNotificationsReadUseCase.execute(req.user.id);

      res.status(200).json({
        success: true,
        message: 'All notifications marked as read.',
      });
    } catch (error) {
      next(error);
    }
  };
}
