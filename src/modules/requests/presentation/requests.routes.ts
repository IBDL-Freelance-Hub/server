import { Router } from 'express';
import { requireAuth, validateRequest, requestsRateLimiter } from '../../../shared/middleware';
import { RequestsController } from './requests.controller';
import { submitRequestSchema } from './requests.schema';
import { memberRequestsRouter } from './member-requests.routes';

const router = Router();
const controller = new RequestsController();

// POST /api/v1/requests — Unified Request Submission (REQ-14, SEC-33)
router.post(
  '/',
  requestsRateLimiter,
  requireAuth,
  validateRequest({ body: submitRequestSchema }),
  controller.submit,
);

// Mount Member Requests Sub-routes (GET /, GET /:referenceCode, POST /:referenceCode/cancel)
router.use('/', memberRequestsRouter);

export const requestsRouter = router;
