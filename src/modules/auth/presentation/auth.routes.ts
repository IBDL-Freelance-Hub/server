import { Router } from 'express';
import {
  validateRequest,
  requireAuth,
  authLoginRateLimiter,
  sensitiveAuthTokenRateLimiter,
} from '../../../shared/middleware';
import {
  activateAccountSchema,
  resendActivationSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth.schema';
import { AuthController } from './auth.controller';

const router = Router();
const controller = new AuthController();

router.get('/me', requireAuth, controller.me);

router.get('/sessions', requireAuth, controller.getActiveSessions);
router.delete('/sessions', requireAuth, controller.revokeOtherSessions);
router.delete('/sessions/:sessionId', requireAuth, controller.revokeSession);

router.post('/activate', validateRequest({ body: activateAccountSchema }), controller.activate);

router.post(
  '/resend-activation',
  sensitiveAuthTokenRateLimiter,
  validateRequest({ body: resendActivationSchema }),
  controller.resendActivation,
);

router.post(
  '/login',
  authLoginRateLimiter,
  validateRequest({ body: loginSchema }),
  controller.login,
);

router.post(
  '/forgot-password',
  sensitiveAuthTokenRateLimiter,
  validateRequest({ body: forgotPasswordSchema }),
  controller.forgotPassword,
);

router.post(
  '/reset-password',
  validateRequest({ body: resetPasswordSchema }),
  controller.resetPassword,
);

router.post(
  '/change-password',
  requireAuth,
  validateRequest({ body: changePasswordSchema }),
  controller.changePassword,
);

router.patch(
  '/password',
  requireAuth,
  validateRequest({ body: changePasswordSchema }),
  controller.changePassword,
);

router.post('/logout', controller.logout);

export const authRouter = router;
