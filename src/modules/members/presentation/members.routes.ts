import { Router } from 'express';
import { validateRequest, requireAuth } from '../../../shared/middleware';
import {
  registerMemberSchema,
  checkDuplicateSchema,
  updateMemberProfileSchema,
} from './members.schema';
import { MembersController } from './members.controller';

const router = Router();
const controller = new MembersController();

router.post('/register', validateRequest({ body: registerMemberSchema }), controller.register);

router.post(
  '/check-duplicate',
  validateRequest({ body: checkDuplicateSchema }),
  controller.checkDuplicate,
);

// Member Dashboard & Profile Routes (Protected)
router.get('/dashboard', requireAuth, controller.getDashboard);
router.get('/profile', requireAuth, controller.getProfile);

router.patch(
  '/profile',
  requireAuth,
  validateRequest({ body: updateMemberProfileSchema }),
  controller.updateProfile,
);

export const membersRouter = router;
