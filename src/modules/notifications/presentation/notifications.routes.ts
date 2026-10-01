import { Router } from 'express';
import { requireAuth, validateRequest } from '../../../shared/middleware';
import { NotificationsController } from './notifications.controller';
import { notificationIdParamSchema } from './notifications.schema';

const router = Router();
const controller = new NotificationsController();

router.use(requireAuth);

// GET /api/v1/notifications
router.get('/', controller.getNotifications);

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', controller.markAllAsRead);

// PATCH /api/v1/notifications/:id/read
router.patch(
  '/:id/read',
  validateRequest({ params: notificationIdParamSchema }),
  controller.markAsRead,
);

export const notificationsRouter = router;
