import { Router } from 'express';
import { requireAuth, validateRequest } from '../../../shared/middleware';
import { upgradeMembershipSchema } from './membership.schema';
import { MembershipController } from './membership.controller';

const router = Router();
const controller = new MembershipController();

// Protected Membership Upgrade Route (SEC-33, PAY-01 to PAY-12)
router.post(
  '/upgrade',
  requireAuth,
  validateRequest({ body: upgradeMembershipSchema }),
  controller.upgrade,
);

export const membershipRouter = router;
