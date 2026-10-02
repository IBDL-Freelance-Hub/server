/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express';
import { MemberTransactionsController } from '../../../../src/modules/transactions/presentation/member-transactions.controller';
import { AdminTransactionsController } from '../../../../src/modules/transactions/presentation/admin-transactions.controller';
import { ListTransactionsUseCase } from '../../../../src/modules/transactions/application/list-transactions.usecase';
import { GetTransactionByInvoiceUseCase } from '../../../../src/modules/transactions/application/get-transaction-by-invoice.usecase';
import { MemberRequestsController } from '../../../../src/modules/requests/presentation/member-requests.controller';
import { PayMemberRequestUseCase } from '../../../../src/modules/requests/application/pay-member-request.usecase';
import { AuthenticationError, AuthorizationError } from '../../../../src/shared/errors';
import { TransactionStatus, PaymentMethod } from '@prisma/client';

describe('Transactions Controllers Unit Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockReq = {
      headers: {},
      params: {},
      query: {},
      body: {},
      id: 'test-req-id',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as unknown as Request['socket'],
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('MemberTransactionsController', () => {
    let mockListUseCase: jest.Mocked<ListTransactionsUseCase>;
    let mockGetUseCase: jest.Mocked<GetTransactionByInvoiceUseCase>;
    let controller: MemberTransactionsController;

    beforeEach(() => {
      mockListUseCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<ListTransactionsUseCase>;

      mockGetUseCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<GetTransactionByInvoiceUseCase>;

      controller = new MemberTransactionsController(mockListUseCase, mockGetUseCase);
    });

    it('listTransactions: should throw AuthenticationError if req.user is missing', async () => {
      mockReq.user = undefined;
      await controller.listTransactions(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('listTransactions: should throw AuthorizationError if userType is not MEMBER', async () => {
      mockReq.user = { id: 'u1', userType: 'STAFF' } as any;
      await controller.listTransactions(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });

    it('listTransactions: should return 200 with member transactions', async () => {
      mockReq.user = { id: 'member-1', userType: 'MEMBER' } as any;
      mockReq.query = { limit: '10' };

      const mockResult = {
        items: [
          {
            id: 'tx-1',
            invoiceNumber: 'INV-2026-00001',
            userId: 'member-1',
            sourceType: 'REQUEST',
            sourceId: 'req-1',
            amountCents: 15000,
            currency: 'USD',
            status: TransactionStatus.PAID,
            paymentMethod: PaymentMethod.ADMIN_MANUAL,
            paymentReference: 'REF-1',
            billingDetails: {},
            paidAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
        nextCursor: undefined,
        total: 1,
      };

      mockListUseCase.execute.mockResolvedValue(mockResult);

      await controller.listTransactions(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.items,
        pagination: { nextCursor: undefined, total: 1 },
      });
    });

    it('getTransactionByInvoice: should throw AuthenticationError if req.user is missing', async () => {
      mockReq.user = undefined;
      mockReq.params = { invoiceNumber: 'INV-2026-00001' };
      await controller.getTransactionByInvoice(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('getTransactionByInvoice: should return 200 with invoice data', async () => {
      mockReq.user = { id: 'member-1', userType: 'MEMBER' } as any;
      mockReq.params = { invoiceNumber: 'INV-2026-00001' };

      const mockTx = {
        id: 'tx-1',
        invoiceNumber: 'INV-2026-00001',
        userId: 'member-1',
        sourceType: 'REQUEST',
        sourceId: 'req-1',
        amountCents: 15000,
        currency: 'USD',
        status: TransactionStatus.PAID,
        paymentMethod: PaymentMethod.SIMULATED_GATEWAY,
        paymentReference: 'PAY-SIM-123',
        billingDetails: { itemTitle: 'Test Service' },
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      mockGetUseCase.execute.mockResolvedValue(mockTx);

      await controller.getTransactionByInvoice(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockTx,
      });
    });
  });

  describe('AdminTransactionsController', () => {
    let mockListUseCase: jest.Mocked<ListTransactionsUseCase>;
    let mockGetUseCase: jest.Mocked<GetTransactionByInvoiceUseCase>;
    let controller: AdminTransactionsController;

    beforeEach(() => {
      mockListUseCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<ListTransactionsUseCase>;

      mockGetUseCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<GetTransactionByInvoiceUseCase>;

      controller = new AdminTransactionsController(mockListUseCase, mockGetUseCase);
    });

    it('listTransactions: should throw AuthenticationError if req.user is missing', async () => {
      mockReq.user = undefined;
      await controller.listTransactions(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('listTransactions: should return 200 with ledger data for staff', async () => {
      mockReq.user = { id: 'staff-1', userType: 'STAFF', staffRole: 'FINANCE_OFFICER' } as any;
      mockReq.query = { userId: 'target-user-1' };

      const mockResult = {
        items: [],
        nextCursor: undefined,
        total: 0,
      };

      mockListUseCase.execute.mockResolvedValue(mockResult);

      await controller.listTransactions(mockReq as Request, mockRes as Response, mockNext);

      expect(mockListUseCase.execute).toHaveBeenCalledWith({
        requesterUserId: 'staff-1',
        isStaff: true,
        targetUserId: 'target-user-1',
        cursor: undefined,
        limit: undefined,
        sourceType: undefined,
        status: undefined,
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('MemberRequestsController.payRequest', () => {
    let mockPayUseCase: jest.Mocked<PayMemberRequestUseCase>;
    let controller: MemberRequestsController;

    beforeEach(() => {
      mockPayUseCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<PayMemberRequestUseCase>;

      controller = new MemberRequestsController(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockPayUseCase,
      );
    });

    it('should throw AuthenticationError if req.user is missing', async () => {
      mockReq.user = undefined;
      mockReq.params = { id: 'req-1' };
      await controller.payRequest(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should return 200 when payment succeeds', async () => {
      mockReq.user = { id: 'member-1', userType: 'MEMBER' } as any;
      mockReq.params = { id: 'req-1' };
      mockReq.body = { paymentMethodId: 'card_sim_123' };

      const payResult = {
        id: 'req-1',
        referenceCode: 'REQ-2026-0001',
        status: 'PAYMENT_CONFIRMED' as any,
        paymentReference: 'PAY-SIM-123',
        invoiceNumber: 'INV-2026-00001',
        paidAt: new Date().toISOString(),
        message: 'Payment settled successfully.',
      };

      mockPayUseCase.execute.mockResolvedValue(payResult);

      await controller.payRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPayUseCase.execute).toHaveBeenCalledWith(
        'member-1',
        'req-1',
        { paymentMethodId: 'card_sim_123' },
        expect.objectContaining({ ipAddress: '127.0.0.1' }),
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: payResult,
      });
    });
  });
});
