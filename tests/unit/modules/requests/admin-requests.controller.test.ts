import { Request, Response, NextFunction } from 'express';
import {
  EngagementRequestStatus,
  StaffRole,
  CatalogItemCategory,
  PricingModel,
  MembershipTier,
  MembershipStatus,
} from '@prisma/client';
import { AdminRequestsController } from '../../../../src/modules/requests/presentation/admin-requests.controller';
import { AdminStartReviewUseCase } from '../../../../src/modules/requests/application/admin-start-review.usecase';
import { AdminRequestInfoUseCase } from '../../../../src/modules/requests/application/admin-request-info.usecase';
import { AdminRejectRequestUseCase } from '../../../../src/modules/requests/application/admin-reject-request.usecase';
import { AdminApproveRequestUseCase } from '../../../../src/modules/requests/application/admin-approve-request.usecase';
import { AdminFulfillRequestUseCase } from '../../../../src/modules/requests/application/admin-fulfill-request.usecase';
import { AdminMarkPaidUseCase } from '../../../../src/modules/requests/application/admin-mark-paid.usecase';
import { AdminListRequestsUseCase } from '../../../../src/modules/requests/application/admin-list-requests.usecase';
import { AdminGetRequestByIdUseCase } from '../../../../src/modules/requests/application/admin-get-request-by-id.usecase';
import { AuthenticationError, ValidationError } from '../../../../src/shared/errors';

describe('AdminRequestsController Unit Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  let mockStartReviewUseCase: jest.Mocked<AdminStartReviewUseCase>;
  let mockRequestInfoUseCase: jest.Mocked<AdminRequestInfoUseCase>;
  let mockRejectRequestUseCase: jest.Mocked<AdminRejectRequestUseCase>;
  let mockApproveRequestUseCase: jest.Mocked<AdminApproveRequestUseCase>;
  let mockFulfillRequestUseCase: jest.Mocked<AdminFulfillRequestUseCase>;
  let mockMarkPaidUseCase: jest.Mocked<AdminMarkPaidUseCase>;
  let mockListRequestsUseCase: jest.Mocked<AdminListRequestsUseCase>;
  let mockGetRequestByIdUseCase: jest.Mocked<AdminGetRequestByIdUseCase>;

  let controller: AdminRequestsController;

  beforeEach(() => {
    mockReq = {
      headers: {},
      params: { id: 'REQ-2026-0001' },
      query: {},
      body: {},
      id: 'trace-id-abc',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as unknown as Request['socket'],
      user: {
        id: 'staff-user-1',
        email: 'admin@ibdl.net',
        userType: 'STAFF',
        status: 'ACTIVE',
        staffRole: StaffRole.REVIEWER_OPERATOR,
        memberId: null,
        sessionId: 'session-1',
        member: null,
      },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    mockStartReviewUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<AdminStartReviewUseCase>;
    mockRequestInfoUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<AdminRequestInfoUseCase>;
    mockRejectRequestUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<AdminRejectRequestUseCase>;
    mockApproveRequestUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<AdminApproveRequestUseCase>;
    mockFulfillRequestUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<AdminFulfillRequestUseCase>;
    mockMarkPaidUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<AdminMarkPaidUseCase>;
    mockListRequestsUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<AdminListRequestsUseCase>;
    mockGetRequestByIdUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<AdminGetRequestByIdUseCase>;

    controller = new AdminRequestsController(
      mockStartReviewUseCase,
      mockRequestInfoUseCase,
      mockRejectRequestUseCase,
      mockApproveRequestUseCase,
      mockFulfillRequestUseCase,
      mockMarkPaidUseCase,
      mockListRequestsUseCase,
      mockGetRequestByIdUseCase,
    );
  });

  describe('listRequests', () => {
    it('should return 200 with paginated admin requests list', async () => {
      mockListRequestsUseCase.execute.mockResolvedValue({
        requests: [
          {
            id: 'req-1',
            referenceCode: 'REQ-2026-0001',
            category: CatalogItemCategory.CORE_SERVICE,
            pricingModel: PricingModel.FIXED,
            status: EngagementRequestStatus.UNDER_REVIEW,
            member: {
              id: 'member-1',
              fullNameEn: 'Sarah Connor',
              fullNameAr: null,
              email: 'sarah@example.com',
            },
            catalogItem: {
              id: 'item-1',
              nameEn: 'TNA',
              slug: 'tna',
            },
            pricing: {
              tierAtRequest: MembershipTier.ESSENTIAL,
              membershipStatusAtRequest: MembershipStatus.ACTIVE,
              basePrice: 10000,
              discountAmount: 1500,
              finalPrice: 8500,
              currency: 'USD',
              isQuarterlyEntitlement: false,
            },
            paymentReference: null,
            paidAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      });

      await controller.listRequests(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
          pagination: expect.objectContaining({ total: 1 }),
        }),
      );
    });
  });

  describe('getRequestById', () => {
    it('should return 200 with complete request details', async () => {
      mockGetRequestByIdUseCase.execute.mockResolvedValue({
        id: 'req-1',
        referenceCode: 'REQ-2026-0001',
        category: CatalogItemCategory.CORE_SERVICE,
        pricingModel: PricingModel.FIXED,
        status: EngagementRequestStatus.UNDER_REVIEW,
        member: {
          id: 'member-1',
          userId: 'user-1',
          fullNameEn: 'Sarah Connor',
          fullNameAr: null,
          email: 'sarah@example.com',
          phone: '+971501234567',
          country: 'United Arab Emirates',
        },
        catalogItem: {
          id: 'item-1',
          slug: 'tna',
          nameEn: 'TNA',
          nameAr: null,
          category: CatalogItemCategory.CORE_SERVICE,
          pricingModel: PricingModel.FIXED,
          basePrice: 10000,
          percentageRate: null,
        },
        pricing: {
          tierAtRequest: MembershipTier.ESSENTIAL,
          membershipStatusAtRequest: MembershipStatus.ACTIVE,
          baseAmount: null,
          basePrice: 10000,
          discountPercentage: 15.0,
          discountAmount: 1500,
          finalPrice: 8500,
          currency: 'USD',
          isQuarterlyEntitlement: false,
          quarterIndex: null,
          membershipYear: null,
        },
        brief: null,
        customRequirements: null,
        intakeData: null,
        adminNotes: null,
        reviewNotes: null,
        rejectionReason: null,
        cancellationReason: null,
        paymentReference: null,
        paidAt: null,
        infoRequestedAt: null,
        approvedAt: null,
        fulfilledAt: null,
        cancelledAt: null,
        rejectedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await controller.getRequestById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ referenceCode: 'REQ-2026-0001' }),
        }),
      );
    });
  });

  describe('startReview', () => {
    it('should return 200 with review status', async () => {
      mockStartReviewUseCase.execute.mockResolvedValue({
        id: 'req-1',
        referenceCode: 'REQ-2026-0001',
        status: EngagementRequestStatus.UNDER_REVIEW,
        message: 'Request is now under review.',
        updatedAt: new Date().toISOString(),
      });

      await controller.startReview(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ status: EngagementRequestStatus.UNDER_REVIEW }),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should forward AuthenticationError if user is unauthenticated', async () => {
      mockReq.user = undefined;

      await controller.startReview(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('requestInfo', () => {
    it('should return 200 with awaiting response status', async () => {
      mockReq.body = { reviewNotes: 'Need updated portfolio' };
      mockRequestInfoUseCase.execute.mockResolvedValue({
        id: 'req-1',
        referenceCode: 'REQ-2026-0001',
        status: EngagementRequestStatus.AWAITING_RESPONSE,
        reviewNotes: 'Need updated portfolio',
        infoRequestedAt: new Date().toISOString(),
        message: 'Information requested.',
      });

      await controller.requestInfo(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ reviewNotes: 'Need updated portfolio' }),
      });
    });
  });

  describe('reject', () => {
    it('should return 200 with rejection details', async () => {
      mockReq.body = { rejectionReason: 'Incomplete requirements' };
      mockRejectRequestUseCase.execute.mockResolvedValue({
        id: 'req-1',
        referenceCode: 'REQ-2026-0001',
        status: EngagementRequestStatus.REJECTED,
        rejectionReason: 'Incomplete requirements',
        rejectedAt: new Date().toISOString(),
        message: 'Request rejected.',
      });

      await controller.reject(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ rejectionReason: 'Incomplete requirements' }),
      });
    });
  });

  describe('approve', () => {
    it('should return 200 with calculated approved pricing', async () => {
      mockReq.body = { baseAmount: 50000, adminNotes: 'Approved with verified project value' };
      mockApproveRequestUseCase.execute.mockResolvedValue({
        id: 'req-1',
        referenceCode: 'REQ-2026-0001',
        status: EngagementRequestStatus.AWAITING_PAYMENT,
        pricing: {
          basePrice: 2500,
          discountPercentage: 15.0,
          discountAmount: 375,
          finalPrice: 2125,
          currency: 'USD',
          isQuarterlyEntitlementApplied: false,
          isFirstUseFreeApplied: false,
          isIncludedWithPlan: false,
          ruleCitation: 'Fixed item standard tier discount',
        },
        approvedAt: new Date().toISOString(),
        message: 'Request approved and moved to awaiting payment.',
      });

      await controller.approve(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: EngagementRequestStatus.AWAITING_PAYMENT,
          pricing: expect.objectContaining({ finalPrice: 2125 }),
        }),
      });
    });
  });

  describe('fulfill', () => {
    it('should return 200 with fulfillment details', async () => {
      mockReq.body = { deliveryNotes: 'Credentials sent' };
      mockFulfillRequestUseCase.execute.mockResolvedValue({
        id: 'req-1',
        referenceCode: 'REQ-2026-0001',
        status: EngagementRequestStatus.FULFILLED,
        fulfilledAt: new Date().toISOString(),
        entitlement: {
          type: 'ASSESSMENT_CREDENTIAL',
          username: 'user_123',
          grantedAt: new Date().toISOString(),
        },
        message: 'Request fulfilled.',
      });

      await controller.fulfill(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ status: EngagementRequestStatus.FULFILLED }),
      });
    });
  });

  describe('markPaid', () => {
    it('should return 200 with payment confirmation', async () => {
      mockReq.body = { paymentRef: 'TXN-9988' };
      mockMarkPaidUseCase.execute.mockResolvedValue({
        id: 'req-1',
        referenceCode: 'REQ-2026-0001',
        status: EngagementRequestStatus.PAYMENT_CONFIRMED,
        paymentReference: 'TXN-9988',
        paidAt: new Date().toISOString(),
        isIdempotent: false,
        message: 'Payment recorded.',
      });

      await controller.markPaid(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ paymentReference: 'TXN-9988' }),
      });
    });
  });

  describe('parameter validation', () => {
    it('should forward ValidationError if request id is missing or whitespace', async () => {
      mockReq.params = { id: '   ' };

      await controller.startReview(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });
});
