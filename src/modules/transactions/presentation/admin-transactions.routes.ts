import { Router } from 'express';
import { StaffRole } from '@prisma/client';
import { requireAuth, requireStaffRole, validateRequest } from '../../../shared/middleware';
import { AdminTransactionsController } from './admin-transactions.controller';
import { adminListTransactionsQuerySchema, invoiceNumberParamSchema } from './transactions.schema';

const router = Router();
const controller = new AdminTransactionsController();

// GET /api/v1/admin/transactions — Staff listing of all transactions
router.get(
  '/',
  requireAuth,
  requireStaffRole([StaffRole.FINANCE_OFFICER, StaffRole.SYSTEM_ADMINISTRATOR]),
  validateRequest({ query: adminListTransactionsQuerySchema }),
  controller.listTransactions,
);

// GET /api/v1/admin/transactions/:invoiceNumber — Staff invoice lookup
router.get(
  '/:invoiceNumber',
  requireAuth,
  requireStaffRole([StaffRole.FINANCE_OFFICER, StaffRole.SYSTEM_ADMINISTRATOR]),
  validateRequest({ params: invoiceNumberParamSchema }),
  controller.getTransactionByInvoice,
);

export const adminTransactionsRouter = router;
