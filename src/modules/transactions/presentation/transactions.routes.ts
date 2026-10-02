import { Router } from 'express';
import { requireAuth, validateRequest } from '../../../shared/middleware';
import { MemberTransactionsController } from './member-transactions.controller';
import { listMemberTransactionsQuerySchema, invoiceNumberParamSchema } from './transactions.schema';

const router = Router();
const controller = new MemberTransactionsController();

// GET /api/v1/transactions — List authenticated member's transactions
router.get(
  '/',
  requireAuth,
  validateRequest({ query: listMemberTransactionsQuerySchema }),
  controller.listTransactions,
);

// GET /api/v1/transactions/:invoiceNumber — Get authenticated member's invoice
router.get(
  '/:invoiceNumber',
  requireAuth,
  validateRequest({ params: invoiceNumberParamSchema }),
  controller.getTransactionByInvoice,
);

export const transactionsRouter = router;
