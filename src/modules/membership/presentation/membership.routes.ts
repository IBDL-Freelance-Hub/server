import { Router } from 'express';
import { requireAuth, optionalAuth, validateRequest } from '../../../shared/middleware';
import { upgradeMembershipSchema } from './membership.schema';
import { MembershipController } from './membership.controller';

const router = Router();
const controller = new MembershipController();

// Public / Session-Aware Membership Tiers Catalog (SCR-68, SCR-70, SEC-33)
router.get('/tiers', optionalAuth, controller.getTiers);

// Protected Membership Upgrade Route (SEC-33, PAY-01 to PAY-12)
router.post(
  '/upgrade',
  requireAuth,
  validateRequest({ body: upgradeMembershipSchema }),
  controller.upgrade,
);

export const membershipRouter = router;
