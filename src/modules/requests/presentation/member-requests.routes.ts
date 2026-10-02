import { Router } from 'express';
import { requireAuth, validateRequest } from '../../../shared/middleware';
import { MemberRequestsController } from './member-requests.controller';
import {
  listMemberRequestsQuerySchema,
  requestIdOrRefParamSchema,
  cancelMemberRequestSchema,
  respondInfoMemberRequestSchema,
} from './member-requests.schema';

const router = Router();
const controller = new MemberRequestsController();

// GET /api/v1/requests — List Member Requests (Tenant-Isolated, MEM-78f)
router.get(
  '/',
  requireAuth,
  validateRequest({ query: listMemberRequestsQuerySchema }),
  controller.listRequests,
);

// GET /api/v1/requests/:id — Get Member Request Details
router.get(
  '/:id',
  requireAuth,
  validateRequest({ params: requestIdOrRefParamSchema }),
  controller.getRequestByRef,
);

// POST /api/v1/requests/:id/cancel — Cancel Request
router.post(
  '/:id/cancel',
  requireAuth,
  validateRequest({
    params: requestIdOrRefParamSchema,
    body: cancelMemberRequestSchema,
  }),
  controller.cancelRequest,
);

// POST /api/v1/requests/:id/respond-info — Respond to info request
router.post(
  '/:id/respond-info',
  requireAuth,
  validateRequest({
    params: requestIdOrRefParamSchema,
    body: respondInfoMemberRequestSchema,
  }),
  controller.respondInfo,
);

export const memberRequestsRouter = router;
