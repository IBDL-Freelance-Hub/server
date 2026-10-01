import { Request, Response, NextFunction } from 'express';
import { ServicesController } from '../../../../src/modules/requests/presentation/services.controller';
import { ShopController } from '../../../../src/modules/requests/presentation/shop.controller';
import { MemberRequestsController } from '../../../../src/modules/requests/presentation/member-requests.controller';
import { ListCoreServicesUseCase } from '../../../../src/modules/requests/application/list-core-services.usecase';
import { RequestCoreServiceUseCase } from '../../../../src/modules/requests/application/request-core-service.usecase';
import { ListDiagnosticToolsUseCase } from '../../../../src/modules/requests/application/list-diagnostic-tools.usecase';
import { OrderDiagnosticToolUseCase } from '../../../../src/modules/requests/application/order-diagnostic-tool.usecase';
import { ListMemberRequestsUseCase } from '../../../../src/modules/requests/application/list-member-requests.usecase';
import { GetMemberRequestByRefUseCase } from '../../../../src/modules/requests/application/get-member-request-by-ref.usecase';
import { CancelMemberRequestUseCase } from '../../../../src/modules/requests/application/cancel-member-request.usecase';
import { RequestsController } from '../../../../src/modules/requests/presentation/requests.controller';
import { SubmitUnifiedRequestUseCase } from '../../../../src/modules/requests/application/submit-unified-request.usecase';
import { AuthenticationError } from '../../../../src/shared/errors';

describe('Requests, Services, and Shop Controllers Unit Tests', () => {
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
      setHeader: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('ServicesController', () => {
    let mockListUseCase: jest.Mocked<ListCoreServicesUseCase>;
    let mockRequestUseCase: jest.Mocked<RequestCoreServiceUseCase>;
    let controller: ServicesController;

    beforeEach(() => {
      mockListUseCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<ListCoreServicesUseCase>;

      mockRequestUseCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<RequestCoreServiceUseCase>;

      controller = new ServicesController(mockListUseCase, mockRequestUseCase);
    });

    it('getServices should return 200 with services list', async () => {
      mockListUseCase.execute.mockResolvedValue([]);

      await controller.getServices(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: [] });
    });

    it('requestService should throw AuthenticationError if user is not in session', async () => {
      mockReq.params = { slug: 'training-needs-analysis' };
      mockReq.user = undefined;

      await controller.requestService(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('requestService should return 201 on success', async () => {
      mockReq.params = { slug: 'training-needs-analysis' };
      mockReq.user = { id: 'user-1' } as Request['user'];
      mockRequestUseCase.execute.mockResolvedValue({
        id: 'req-1',
        referenceCode: 'REQ-2026-A8K2',
        serviceName: 'TNA',
        slug: 'training-needs-analysis',
        status: 'UNDER_REVIEW' as unknown as import('@prisma/client').EngagementRequestStatus,
        basePrice: 150,
        discountPercentage: 100,
        finalPrice: 0,
        currency: 'USD',
        isIncludedWithPlan: true,
        message: 'Success',
        createdAt: new Date().toISOString(),
      });

      await controller.requestService(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ referenceCode: 'REQ-2026-A8K2' }),
        }),
      );
    });
  });

  describe('ShopController', () => {
    let mockListToolsUseCase: jest.Mocked<ListDiagnosticToolsUseCase>;
    let mockOrderToolUseCase: jest.Mocked<OrderDiagnosticToolUseCase>;
    let controller: ShopController;

    beforeEach(() => {
      mockListToolsUseCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<ListDiagnosticToolsUseCase>;

      mockOrderToolUseCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<OrderDiagnosticToolUseCase>;

      controller = new ShopController(mockListToolsUseCase, mockOrderToolUseCase);
    });

    it('getTools should return 200 with tools list', async () => {
      mockListToolsUseCase.execute.mockResolvedValue([]);

      await controller.getTools(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: [] });
    });

    it('orderTool should return 201 on successful order', async () => {
      mockReq.params = { slug: 'pqp' };
      mockReq.user = { id: 'user-1' } as Request['user'];
      mockOrderToolUseCase.execute.mockResolvedValue({
        id: 'order-1',
        referenceCode: 'REQ-2026-PQP1',
        toolName: 'PQP',
        slug: 'pqp',
        status: 'PAYMENT_CONFIRMED' as unknown as import('@prisma/client').EngagementRequestStatus,
        basePrice: 120,
        discountPercentage: 100,
        finalPrice: 0,
        currency: 'USD',
        isQuarterlyEntitlementApplied: true,
        message: 'Success',
        createdAt: new Date().toISOString(),
      });

      await controller.orderTool(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ referenceCode: 'REQ-2026-PQP1' }),
        }),
      );
    });
  });

  describe('MemberRequestsController', () => {
    let mockListUseCase: jest.Mocked<ListMemberRequestsUseCase>;
    let mockGetByRefUseCase: jest.Mocked<GetMemberRequestByRefUseCase>;
    let mockCancelUseCase: jest.Mocked<CancelMemberRequestUseCase>;
    let controller: MemberRequestsController;

    beforeEach(() => {
      mockListUseCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<ListMemberRequestsUseCase>;
      mockGetByRefUseCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<GetMemberRequestByRefUseCase>;
      mockCancelUseCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<CancelMemberRequestUseCase>;

      controller = new MemberRequestsController(
        mockListUseCase,
        mockGetByRefUseCase,
        mockCancelUseCase,
      );
    });

    it('listRequests should return 200 with paginated requests', async () => {
      mockReq.user = { id: 'user-1' } as Request['user'];
      mockListUseCase.execute.mockResolvedValue({
        requests: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
      });

      await controller.listRequests(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [],
          pagination: expect.any(Object),
        }),
      );
    });

    it('getRequestByRef should return 200 with request details', async () => {
      mockReq.user = { id: 'user-1' } as Request['user'];
      mockReq.params = { referenceCode: 'REQ-2026-A8K2' };
      mockGetByRefUseCase.execute.mockResolvedValue({
        id: 'req-1',
        referenceCode: 'REQ-2026-A8K2',
      } as unknown as import('../../../../src/modules/requests/application/get-member-request-by-ref.usecase').MemberRequestDetailDTO);

      await controller.getRequestByRef(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ referenceCode: 'REQ-2026-A8K2' }),
        }),
      );
    });

    it('cancelRequest should return 200 with cancellation confirmation', async () => {
      mockReq.user = { id: 'user-1' } as Request['user'];
      mockReq.params = { referenceCode: 'REQ-2026-A8K2' };
      mockCancelUseCase.execute.mockResolvedValue({
        id: 'req-uuid-1',
        referenceCode: 'REQ-2026-A8K2',
        status: 'CANCELLED' as unknown as import('@prisma/client').EngagementRequestStatus,
        cancellationReason: 'No longer needed',
        cancelledAt: new Date().toISOString(),
        message: 'Cancelled',
      });

      await controller.cancelRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });
  });

  describe('RequestsController', () => {
    let mockSubmitUseCase: jest.Mocked<SubmitUnifiedRequestUseCase>;
    let controller: RequestsController;

    beforeEach(() => {
      mockSubmitUseCase = {
        execute: jest.fn(),
      } as unknown as jest.Mocked<SubmitUnifiedRequestUseCase>;

      controller = new RequestsController(mockSubmitUseCase);
    });

    it('submit should throw AuthenticationError if req.user is missing', async () => {
      mockReq.user = undefined;
      await controller.submit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('submit should return 201 on successful unified submission', async () => {
      mockReq.user = { id: 'user-1' } as Request['user'];
      mockReq.body = {
        itemSlug: 'pqp',
        brief: { assessmentEmail: 'trainee@example.com' },
        acknowledgement: true,
      };

      mockSubmitUseCase.execute.mockResolvedValue({
        id: 'order-1',
        referenceCode: 'REQ-2026-PQP1',
        itemName: 'PQP',
        itemSlug: 'pqp',
        category: 'DIAGNOSTIC_TOOL' as unknown as import('@prisma/client').CatalogItemCategory,
        status: 'PAYMENT_CONFIRMED' as unknown as import('@prisma/client').EngagementRequestStatus,
        pricingModel: 'FREE_THEN_PAID' as unknown as import('@prisma/client').PricingModel,
        basePrice: 12000,
        discountPercentage: 100,
        finalPrice: 0,
        currency: 'USD',
        isQuarterlyEntitlementApplied: false,
        isFirstUseFreeApplied: true,
        isIncludedWithPlan: true,
        message: 'Order created',
        createdAt: new Date().toISOString(),
      });

      await controller.submit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          referenceCode: 'REQ-2026-PQP1',
          finalPrice: 0,
        }),
      });
    });
  });
});
