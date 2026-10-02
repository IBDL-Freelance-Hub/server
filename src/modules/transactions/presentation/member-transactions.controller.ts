import { Request, Response, NextFunction } from 'express';
import { TransactionStatus } from '@prisma/client';
import { ListTransactionsUseCase } from '../application/list-transactions.usecase';
import { GetTransactionByInvoiceUseCase } from '../application/get-transaction-by-invoice.usecase';
import { AuthenticationError, AuthorizationError } from '../../../shared/errors';

export class MemberTransactionsController {
  constructor(
    private readonly listTransactionsUseCase: ListTransactionsUseCase = new ListTransactionsUseCase(),
    private readonly getTransactionByInvoiceUseCase: GetTransactionByInvoiceUseCase = new GetTransactionByInvoiceUseCase(),
  ) {}

  listTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required to view your transactions.');
      }
      if (req.user.userType !== 'MEMBER') {
        throw new AuthorizationError('Only members can access this transaction history.');
      }

      const result = await this.listTransactionsUseCase.execute({
        requesterUserId: req.user.id,
        isStaff: false,
        cursor: req.query['cursor'] as string | undefined,
        limit: req.query['limit'] ? Number(req.query['limit']) : undefined,
        sourceType: req.query['sourceType'] as string | undefined,
        status: req.query['status'] as TransactionStatus | undefined,
      });

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          nextCursor: result.nextCursor,
          total: result.total,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getTransactionByInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required to view invoice.');
      }
      if (req.user.userType !== 'MEMBER') {
        throw new AuthorizationError('Only members can access this invoice.');
      }

      const invoiceNumber = String(req.params['invoiceNumber'] || '').trim();
      const result = await this.getTransactionByInvoiceUseCase.execute({
        invoiceNumber,
        requesterUserId: req.user.id,
        isStaff: false,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
