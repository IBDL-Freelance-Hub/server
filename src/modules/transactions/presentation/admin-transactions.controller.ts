import { Request, Response, NextFunction } from 'express';
import { TransactionStatus } from '@prisma/client';
import { ListTransactionsUseCase } from '../application/list-transactions.usecase';
import { GetTransactionByInvoiceUseCase } from '../application/get-transaction-by-invoice.usecase';
import { AuthenticationError } from '../../../shared/errors';

export class AdminTransactionsController {
  constructor(
    private readonly listTransactionsUseCase: ListTransactionsUseCase = new ListTransactionsUseCase(),
    private readonly getTransactionByInvoiceUseCase: GetTransactionByInvoiceUseCase = new GetTransactionByInvoiceUseCase(),
  ) {}

  listTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required to view transactions ledger.');
      }

      const result = await this.listTransactionsUseCase.execute({
        requesterUserId: req.user.id,
        isStaff: true,
        targetUserId: req.query['userId'] as string | undefined,
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

      const invoiceNumber = String(req.params['invoiceNumber'] || '').trim();
      const result = await this.getTransactionByInvoiceUseCase.execute({
        invoiceNumber,
        requesterUserId: req.user.id,
        isStaff: true,
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
