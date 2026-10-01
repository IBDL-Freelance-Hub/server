import { Router } from 'express';
import { requireAuth, validateRequest } from '../../../shared/middleware';
import { MemberRequestsController } from './member-requests.controller';
import {
  listMemberRequestsQuerySchema,
  requestIdOrRefParamSchema,
  cancelMemberRequestSchema,
  payMemberRequestSchema,
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

// POST /api/v1/requests/:id/pay — Initiate Payment Settlement
router.post(
  '/:id/pay',
  requireAuth,
  validateRequest({
    params: requestIdOrRefParamSchema,
    body: payMemberRequestSchema,
  }),
  controller.payRequest,
);

export const memberRequestsRouter = router;
