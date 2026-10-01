import { z } from 'zod';

export const notificationIdParamSchema = z.object({
  id: z.string().uuid('Invalid notification ID'),
});
