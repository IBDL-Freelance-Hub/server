import { Router } from 'express';
import { StaffRole } from '@prisma/client';
import { requireAuth, requireStaffRole, validateRequest } from '../../../shared/middleware';
import { AdminRequestsController } from './admin-requests.controller';
import {
  adminListRequestsQuerySchema,
  adminRequestIdParamSchema,
  adminRequestInfoSchema,
  adminRejectRequestSchema,
  adminApproveRequestSchema,
  adminFulfillRequestSchema,
  adminMarkPaidSchema,
} from './admin-requests.schema';

const router = Router();
const controller = new AdminRequestsController();

// Global auth guard for all admin request routes
router.use(requireAuth);

/**
 * @route GET /api/v1/admin/requests
 * @desc List and search engagement requests across all members
 * @access OPERATIONS_OFFICER, FINANCE_OFFICER, SYSTEM_ADMINISTRATOR
 */
router.get(
  '/',
  requireStaffRole([
    'OPERATIONS_OFFICER',
    StaffRole.FINANCE_OFFICER,
    StaffRole.SYSTEM_ADMINISTRATOR,
  ]),
  validateRequest({ query: adminListRequestsQuerySchema }),
  controller.listRequests,
);

/**
 * @route GET /api/v1/admin/requests/:id
 * @desc Get complete request details, member context, and credentials
 * @access OPERATIONS_OFFICER, FINANCE_OFFICER, SYSTEM_ADMINISTRATOR
 */
router.get(
  '/:id',
  requireStaffRole([
    'OPERATIONS_OFFICER',
    StaffRole.FINANCE_OFFICER,
    StaffRole.SYSTEM_ADMINISTRATOR,
  ]),
  validateRequest({ params: adminRequestIdParamSchema }),
  controller.getRequestById,
);

/**
 * @route POST /api/v1/admin/requests/:id/start-review
 * @desc Move state to UNDER_REVIEW
 * @access OPERATIONS_OFFICER, SYSTEM_ADMINISTRATOR
 */
router.post(
  '/:id/start-review',
  requireStaffRole(['OPERATIONS_OFFICER', StaffRole.SYSTEM_ADMINISTRATOR]),
  controller.startReview,
);

/**
 * @route POST /api/v1/admin/requests/:id/request-info
 * @desc Move state to AWAITING_RESPONSE with mandatory review notes
 * @access OPERATIONS_OFFICER, SYSTEM_ADMINISTRATOR
 */
router.post(
  '/:id/request-info',
  requireStaffRole(['OPERATIONS_OFFICER', StaffRole.SYSTEM_ADMINISTRATOR]),
  validateRequest({ body: adminRequestInfoSchema }),
  controller.requestInfo,
);

/**
 * @route POST /api/v1/admin/requests/:id/reject
 * @desc Move state to REJECTED with mandatory rejection reason
 * @access OPERATIONS_OFFICER, SYSTEM_ADMINISTRATOR
 */
router.post(
  '/:id/reject',
  requireStaffRole(['OPERATIONS_OFFICER', StaffRole.SYSTEM_ADMINISTRATOR]),
  validateRequest({ body: adminRejectRequestSchema }),
  controller.reject,
);

/**
 * @route POST /api/v1/admin/requests/:id/approve
 * @desc Move state to AWAITING_PAYMENT (or PAYMENT_CONFIRMED if $0) with recalculated price
 * @access OPERATIONS_OFFICER, SYSTEM_ADMINISTRATOR
 */
router.post(
  '/:id/approve',
  requireStaffRole(['OPERATIONS_OFFICER', StaffRole.SYSTEM_ADMINISTRATOR]),
  validateRequest({ body: adminApproveRequestSchema }),
  controller.approve,
);

/**
 * @route POST /api/v1/admin/requests/:id/fulfill
 * @desc Move state to FULFILLED and activate/grant digital entitlement
 * @access OPERATIONS_OFFICER, SYSTEM_ADMINISTRATOR
 */
router.post(
  '/:id/fulfill',
  requireStaffRole(['OPERATIONS_OFFICER', StaffRole.SYSTEM_ADMINISTRATOR]),
  validateRequest({ body: adminFulfillRequestSchema }),
  controller.fulfill,
);

/**
 * @route POST /api/v1/admin/requests/:id/mark-paid
 * @desc Idempotent payment recording by Finance/Admin
 * @access FINANCE_OFFICER, SYSTEM_ADMINISTRATOR
 */
router.post(
  '/:id/mark-paid',
  requireStaffRole([StaffRole.FINANCE_OFFICER, StaffRole.SYSTEM_ADMINISTRATOR]),
  validateRequest({ body: adminMarkPaidSchema }),
  controller.markPaid,
);

export default router;
