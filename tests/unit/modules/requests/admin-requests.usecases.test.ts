import {
  PrismaClient,
  CatalogItemCategory,
  EngagementRequestStatus,
  MembershipTier,
  MembershipStatus,
  PricingModel,
  AssessmentCredentialStatus,
  StaffRole,
} from '@prisma/client';
import { AdminStartReviewUseCase } from '../../../../src/modules/requests/application/admin-start-review.usecase';
import { AdminRequestInfoUseCase } from '../../../../src/modules/requests/application/admin-request-info.usecase';
import { AdminRejectRequestUseCase } from '../../../../src/modules/requests/application/admin-reject-request.usecase';
import { AdminApproveRequestUseCase } from '../../../../src/modules/requests/application/admin-approve-request.usecase';
import { AdminFulfillRequestUseCase } from '../../../../src/modules/requests/application/admin-fulfill-request.usecase';
import { AdminMarkPaidUseCase } from '../../../../src/modules/requests/application/admin-mark-paid.usecase';
import {
  IRequestNotificationService,
  RequestNotificationService,
} from '../../../../src/modules/requests/application/services/request-notification.service';
import { IEmailProvider } from '../../../../src/shared/providers/email.provider';
import { NotFoundError, ValidationError, AuthorizationError } from '../../../../src/shared/errors';
import { requireStaffRole } from '../../../../src/shared/middleware/requireStaffRole.middleware';
import { Request, Response } from 'express';

describe('Admin Endpoints & Transition Side-Effects (Step 4)', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockNotificationSvc: jest.Mocked<IRequestNotificationService>;

  const mockActor = {
    userId: 'staff-user-1',
    staffRole: StaffRole.REVIEWER_OPERATOR,
    ipAddress: '127.0.0.1',
    requestId: 'req-trace-123',
  };

  const createBaseRequest = (
    status: EngagementRequestStatus = EngagementRequestStatus.SUBMITTED,
  ) => ({
    id: 'req-uuid-1',
    referenceCode: 'REQ-2026-0001',
    memberId: 'member-uuid-1',
    catalogItemId: 'cat-item-1',
    category: CatalogItemCategory.CORE_SERVICE,
    status,
    pricingModel: PricingModel.FIXED,
    tierAtRequest: MembershipTier.ESSENTIAL,
    membershipStatusAtRequest: MembershipStatus.ACTIVE,
    standardPrice: 10000,
    baseAmount: null,
    basePrice: 10000,
    discountPercentage: 15.0,
    discountAmount: 1500,
    finalPrice: 8500,
    currency: 'USD',
    isQuarterlyEntitlement: false,
    quarterIndex: null,
    membershipYear: null,
    paymentReference: null,
    paidAt: null,
    adminNotes: null,
    reviewNotes: null,
    rejectionReason: null,
    cancellationReason: null,
    infoRequestedAt: null,
    approvedAt: null,
    fulfilledAt: null,
    cancelledAt: null,
    rejectedAt: null,
    createdAt: new Date('2026-03-01T10:00:00Z'),
    updatedAt: new Date('2026-03-01T10:00:00Z'),
    member: {
      id: 'member-uuid-1',
      userId: 'user-member-1',
      user: {
        id: 'user-member-1',
        email: 'member@example.com',
      },
    },
    catalogItem: {
      id: 'cat-item-1',
      slug: 'training-needs-analysis',
      nameEn: 'TNA Service',
      nameAr: 'خدمة تحليل الاحتياجات',
      basePrice: 10000,
      pricingModel: PricingModel.FIXED,
      percentageRate: null,
    },
  });

  beforeEach(() => {
    mockNotificationSvc = {
      dispatchNotification: jest.fn().mockResolvedValue({
        id: 'notif-1',
        userId: 'user-member-1',
        referenceCode: 'REQ-2026-0001',
        type: 'TEST',
        titleEn: 'Test',
        titleAr: 'اختبار',
        messageEn: 'Test',
        messageAr: 'اختبار',
        createdAt: new Date(),
        isRead: false,
      }),
      getInAppNotificationsForUser: jest.fn().mockResolvedValue([]),
    };

    mockPrisma = {
      engagementRequest: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      assessmentCredentialPool: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
    } as unknown as jest.Mocked<PrismaClient>;
  });

  describe('1. AdminStartReviewUseCase', () => {
    it('should transition request from SUBMITTED to UNDER_REVIEW and trigger side-effects', async () => {
      const baseReq = createBaseRequest(EngagementRequestStatus.SUBMITTED);
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(baseReq);
      (mockPrisma.engagementRequest.update as jest.Mock).mockResolvedValue({
        ...baseReq,
        status: EngagementRequestStatus.UNDER_REVIEW,
      });

      const useCase = new AdminStartReviewUseCase(mockPrisma, mockNotificationSvc);
      const result = await useCase.execute('REQ-2026-0001', mockActor);

      expect(result.status).toBe(EngagementRequestStatus.UNDER_REVIEW);
      expect(mockPrisma.engagementRequest.update).toHaveBeenCalledWith({
        where: { id: baseReq.id },
        data: { status: EngagementRequestStatus.UNDER_REVIEW },
      });

      // Staff AuditLog created
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: mockActor.userId,
            action: 'ADMIN_REQUEST_REVIEW_STARTED',
            resource: 'EngagementRequest',
          }),
        }),
      );

      // Member ActivityLog entry created
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'user-member-1',
            action: 'REQUEST_UNDER_REVIEW',
          }),
        }),
      );

      // Notification dispatched
      expect(mockNotificationSvc.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-member-1',
          type: 'REQUEST_UNDER_REVIEW',
        }),
      );
    });

    it('should throw NotFoundError if request does not exist', async () => {
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(null);
      const useCase = new AdminStartReviewUseCase(mockPrisma, mockNotificationSvc);

      await expect(useCase.execute('INVALID-ID', mockActor)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if transitioning from an invalid state (e.g. FULFILLED)', async () => {
      const baseReq = createBaseRequest(EngagementRequestStatus.FULFILLED);
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(baseReq);

      const useCase = new AdminStartReviewUseCase(mockPrisma, mockNotificationSvc);
      await expect(useCase.execute(baseReq.id, mockActor)).rejects.toThrow(ValidationError);
    });
  });

  describe('2. AdminRequestInfoUseCase', () => {
    it('should transition request from UNDER_REVIEW to AWAITING_RESPONSE with mandatory reviewNotes', async () => {
      const baseReq = createBaseRequest(EngagementRequestStatus.UNDER_REVIEW);
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(baseReq);
      (mockPrisma.engagementRequest.update as jest.Mock).mockResolvedValue({
        ...baseReq,
        status: EngagementRequestStatus.AWAITING_RESPONSE,
        reviewNotes: 'Please upload the latest project requirements doc.',
        infoRequestedAt: new Date(),
      });

      const useCase = new AdminRequestInfoUseCase(mockPrisma, mockNotificationSvc);
      const result = await useCase.execute(
        'REQ-2026-0001',
        { reviewNotes: 'Please upload the latest project requirements doc.' },
        mockActor,
      );

      expect(result.status).toBe(EngagementRequestStatus.AWAITING_RESPONSE);
      expect(result.reviewNotes).toContain('Please upload');

      // Staff AuditLog + Member Timeline Log + Notification
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ADMIN_REQUEST_INFO_REQUESTED',
            reason: 'Please upload the latest project requirements doc.',
          }),
        }),
      );
      expect(mockNotificationSvc.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'REQUEST_INFO_REQUESTED',
        }),
      );
    });

    it('should reject when reviewNotes is shorter than 5 characters', async () => {
      const useCase = new AdminRequestInfoUseCase(mockPrisma, mockNotificationSvc);
      await expect(
        useCase.execute('REQ-2026-0001', { reviewNotes: 'hi' }, mockActor),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('3. AdminRejectRequestUseCase', () => {
    it('should transition request to REJECTED with mandatory rejectionReason', async () => {
      const baseReq = createBaseRequest(EngagementRequestStatus.UNDER_REVIEW);
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(baseReq);
      (mockPrisma.engagementRequest.update as jest.Mock).mockResolvedValue({
        ...baseReq,
        status: EngagementRequestStatus.REJECTED,
        rejectionReason: 'Scope of work falls outside our supported criteria.',
        rejectedAt: new Date(),
      });

      const useCase = new AdminRejectRequestUseCase(mockPrisma, mockNotificationSvc);
      const result = await useCase.execute(
        'REQ-2026-0001',
        { rejectionReason: 'Scope of work falls outside our supported criteria.' },
        mockActor,
      );

      expect(result.status).toBe(EngagementRequestStatus.REJECTED);
      expect(result.rejectionReason).toBe('Scope of work falls outside our supported criteria.');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ADMIN_REQUEST_REJECTED',
            reason: 'Scope of work falls outside our supported criteria.',
          }),
        }),
      );
      expect(mockNotificationSvc.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'REQUEST_REJECTED',
        }),
      );
    });

    it('should fail with ValidationError if rejectionReason is too short', async () => {
      const useCase = new AdminRejectRequestUseCase(mockPrisma, mockNotificationSvc);
      await expect(
        useCase.execute('REQ-2026-0001', { rejectionReason: 'bad' }, mockActor),
      ).rejects.toThrow(ValidationError);
    });

    it('should fail if request is already terminal (REJECTED)', async () => {
      const baseReq = createBaseRequest(EngagementRequestStatus.REJECTED);
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(baseReq);

      const useCase = new AdminRejectRequestUseCase(mockPrisma, mockNotificationSvc);
      await expect(
        useCase.execute('REQ-2026-0001', { rejectionReason: 'Already rejected' }, mockActor),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('4. AdminApproveRequestUseCase', () => {
    it('should calculate approved price and transition to AWAITING_PAYMENT when finalPrice > 0', async () => {
      const baseReq = createBaseRequest(EngagementRequestStatus.UNDER_REVIEW);
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(baseReq);
      (mockPrisma.engagementRequest.update as jest.Mock).mockImplementation(
        async ({ data }: { data: unknown }) => ({
          ...baseReq,
          ...(data as object),
        }),
      );

      const useCase = new AdminApproveRequestUseCase(mockPrisma, mockNotificationSvc);
      const result = await useCase.execute(
        'REQ-2026-0001',
        { adminNotes: 'Approved for standard fixed service' },
        mockActor,
      );

      expect(result.status).toBe(EngagementRequestStatus.AWAITING_PAYMENT);
      expect(result.pricing.finalPrice).toBe(8500); // 10000 - 15% (Essential tier)
      expect(mockNotificationSvc.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'REQUEST_APPROVED',
          titleEn: expect.stringContaining('Awaiting Payment'),
        }),
      );
    });

    it('should transition directly to PAYMENT_CONFIRMED when approved price is $0 (100% discount)', async () => {
      const baseReq = {
        ...createBaseRequest(EngagementRequestStatus.UNDER_REVIEW),
        pricingModel: PricingModel.INCLUDED_OR_QUOTED,
        tierAtRequest: MembershipTier.MASTER,
        isQuarterlyEntitlement: false,
        catalogItem: {
          ...createBaseRequest().catalogItem,
          pricingModel: PricingModel.INCLUDED_OR_QUOTED,
        },
      };
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(baseReq);
      (mockPrisma.engagementRequest.update as jest.Mock).mockImplementation(
        async ({ data }: { data: unknown }) => ({
          ...baseReq,
          ...(data as object),
        }),
      );

      const useCase = new AdminApproveRequestUseCase(mockPrisma, mockNotificationSvc);
      const result = await useCase.execute(
        'REQ-2026-0001',
        { adminNotes: '100% quarterly entitlement applied' },
        mockActor,
      );

      expect(result.status).toBe(EngagementRequestStatus.PAYMENT_CONFIRMED);
      expect(result.pricing.finalPrice).toBe(0);
      expect(mockNotificationSvc.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'REQUEST_APPROVED',
          titleEn: expect.stringContaining('Fully Covered'),
        }),
      );
    });

    it('should handle PERCENTAGE pricingModel using provided baseAmount (project value)', async () => {
      const baseReq = {
        ...createBaseRequest(EngagementRequestStatus.UNDER_REVIEW),
        pricingModel: PricingModel.PERCENTAGE,
        percentageRate: 5.0 as unknown as import('@prisma/client/runtime/library').Decimal,
        standardPrice: null,
        tierAtRequest: MembershipTier.PROFESSIONAL, // 30% discount
        catalogItem: {
          ...createBaseRequest().catalogItem,
          pricingModel: PricingModel.PERCENTAGE,
          percentageRate: 5.0 as unknown as import('@prisma/client/runtime/library').Decimal,
        },
      };
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(baseReq);
      (mockPrisma.engagementRequest.update as jest.Mock).mockImplementation(
        async ({ data }: { data: unknown }) => ({
          ...baseReq,
          ...(data as object),
        }),
      );

      const useCase = new AdminApproveRequestUseCase(mockPrisma, mockNotificationSvc);
      // Project value = 1,000,000 cents ($10,000 USD)
      // 5% rate = 50,000 cents ($500 USD)
      // Professional discount = 30% of 50,000 = 15,000 discount
      // finalPrice = 35,000 cents ($350 USD)
      const result = await useCase.execute(
        'REQ-2026-0001',
        { baseAmount: 1000000, adminNotes: 'Confirmed project value $10k' },
        mockActor,
      );

      expect(result.status).toBe(EngagementRequestStatus.AWAITING_PAYMENT);
      expect(result.pricing.basePrice).toBe(50000);
      expect(result.pricing.discountAmount).toBe(15000);
      expect(result.pricing.finalPrice).toBe(35000);
    });
  });

  describe('5. AdminFulfillRequestUseCase', () => {
    it('should transition from PAYMENT_CONFIRMED to FULFILLED and assign diagnostic tool credential', async () => {
      const baseReq = {
        ...createBaseRequest(EngagementRequestStatus.PAYMENT_CONFIRMED),
        category: CatalogItemCategory.DIAGNOSTIC_TOOL,
      };
      const availableCredential = {
        id: 'cred-1',
        username: 'candidate_user_1',
        password: 'hashed_password',
        accessUrl: 'https://assessment.ibdl.net/login',
        status: AssessmentCredentialStatus.AVAILABLE,
        assignedTo: null,
        assignedAt: null,
        createdAt: new Date(),
      };

      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(baseReq);
      (mockPrisma.assessmentCredentialPool.findFirst as jest.Mock).mockResolvedValue(
        availableCredential,
      );
      (mockPrisma.engagementRequest.update as jest.Mock).mockResolvedValue({
        ...baseReq,
        status: EngagementRequestStatus.FULFILLED,
        fulfilledAt: new Date(),
      });

      const useCase = new AdminFulfillRequestUseCase(mockPrisma, mockNotificationSvc);
      const result = await useCase.execute(
        'REQ-2026-0001',
        { deliveryNotes: 'Credential activated in testing portal.' },
        mockActor,
      );

      expect(result.status).toBe(EngagementRequestStatus.FULFILLED);
      expect(result.entitlement?.username).toBe('candidate_user_1');
      expect(mockPrisma.assessmentCredentialPool.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cred-1' },
          data: expect.objectContaining({
            status: AssessmentCredentialStatus.ASSIGNED,
            assignedTo: 'member-uuid-1',
          }),
        }),
      );
      expect(mockNotificationSvc.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'REQUEST_FULFILLED',
          messageEn: expect.stringContaining('candidate_user_1'),
        }),
      );
    });

    it('should fail if request is not in PAYMENT_CONFIRMED status', async () => {
      const baseReq = createBaseRequest(EngagementRequestStatus.AWAITING_PAYMENT);
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(baseReq);

      const useCase = new AdminFulfillRequestUseCase(mockPrisma, mockNotificationSvc);
      await expect(useCase.execute('REQ-2026-0001', {}, mockActor)).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe('6. AdminMarkPaidUseCase', () => {
    it('should transition from AWAITING_PAYMENT to PAYMENT_CONFIRMED with paymentRef', async () => {
      const baseReq = createBaseRequest(EngagementRequestStatus.AWAITING_PAYMENT);
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(baseReq);
      (mockPrisma.engagementRequest.update as jest.Mock).mockImplementation(
        async ({ data }: { data: unknown }) => ({
          ...baseReq,
          ...(data as object),
        }),
      );

      const financeActor = {
        userId: 'finance-user-1',
        staffRole: StaffRole.FINANCE_OFFICER,
      };

      const useCase = new AdminMarkPaidUseCase(mockPrisma, mockNotificationSvc);
      const result = await useCase.execute(
        'REQ-2026-0001',
        { paymentRef: 'TXN-BANK-998822', adminNotes: 'Wire transfer verified' },
        financeActor,
      );

      expect(result.status).toBe(EngagementRequestStatus.PAYMENT_CONFIRMED);
      expect(result.paymentReference).toBe('TXN-BANK-998822');
      expect(result.isIdempotent).toBe(false);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ADMIN_REQUEST_MARKED_PAID',
            actorRole: StaffRole.FINANCE_OFFICER,
          }),
        }),
      );
    });

    it('should be idempotent and succeed without duplicate mutation if already PAYMENT_CONFIRMED', async () => {
      const baseReq = {
        ...createBaseRequest(EngagementRequestStatus.PAYMENT_CONFIRMED),
        paymentReference: 'EXISTING-REF-123',
        paidAt: new Date(),
      };
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(baseReq);

      const useCase = new AdminMarkPaidUseCase(mockPrisma, mockNotificationSvc);
      const result = await useCase.execute(
        'REQ-2026-0001',
        { paymentRef: 'EXISTING-REF-123' },
        mockActor,
      );

      expect(result.status).toBe(EngagementRequestStatus.PAYMENT_CONFIRMED);
      expect(result.isIdempotent).toBe(true);
      expect(mockPrisma.engagementRequest.update).not.toHaveBeenCalled();
    });

    it('should fail if paymentRef is missing', async () => {
      const useCase = new AdminMarkPaidUseCase(mockPrisma, mockNotificationSvc);
      await expect(useCase.execute('REQ-2026-0001', {}, mockActor)).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe('7. RBAC & Staff Role Guard Middleware', () => {
    it('should allow OPERATIONS_OFFICER (REVIEWER_OPERATOR) to access review routes', () => {
      const middleware = requireStaffRole(['OPERATIONS_OFFICER', StaffRole.SYSTEM_ADMINISTRATOR]);
      const req = {
        user: { userType: 'STAFF', staffRole: StaffRole.REVIEWER_OPERATOR },
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should allow SYSTEM_ADMINISTRATOR to access any staff route', () => {
      const middleware = requireStaffRole([StaffRole.FINANCE_OFFICER]);
      const req = {
        user: { userType: 'STAFF', staffRole: StaffRole.SYSTEM_ADMINISTRATOR },
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should deny access (403 AuthorizationError) when user has wrong staff role', () => {
      const middleware = requireStaffRole([StaffRole.FINANCE_OFFICER]);
      const req = {
        user: { userType: 'STAFF', staffRole: StaffRole.REVIEWER_OPERATOR },
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn();

      expect(() => middleware(req, res, next)).toThrow(AuthorizationError);
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access when user is a MEMBER rather than STAFF', () => {
      const middleware = requireStaffRole(['OPERATIONS_OFFICER']);
      const req = {
        user: { userType: 'MEMBER', staffRole: null },
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn();

      expect(() => middleware(req, res, next)).toThrow(AuthorizationError);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('8. RequestNotificationService Database & Email Delivery', () => {
    it('should persist notification to PostgreSQL and send email alert', async () => {
      const mockEmailProvider: jest.Mocked<IEmailProvider> = {
        sendEmail: jest.fn().mockResolvedValue(undefined),
      };

      const mockPrismaClient = {
        notification: {
          create: jest.fn().mockResolvedValue({
            id: 'notif-db-123',
            userId: 'user-member-1',
            titleEn: 'Request Approved',
            titleAr: 'تمت الموافقة',
            bodyEn: 'Your request was approved.',
            bodyAr: 'تمت الموافقة على طلبك.',
            type: 'REQUEST_APPROVED',
            isRead: false,
            link: '/requests/REQ-2026-0001',
            createdAt: new Date(),
          }),
          findMany: jest.fn().mockResolvedValue([]),
        },
      } as unknown as PrismaClient;

      const service = new RequestNotificationService(mockPrismaClient, mockEmailProvider);
      const result = await service.dispatchNotification({
        userId: 'user-member-1',
        memberEmail: 'member@example.com',
        referenceCode: 'REQ-2026-0001',
        type: 'REQUEST_APPROVED',
        titleEn: 'Request Approved',
        titleAr: 'تمت الموافقة',
        messageEn: 'Your request was approved.',
        messageAr: 'تمت الموافقة على طلبك.',
      });

      expect(result.id).toBe('notif-db-123');
      expect(mockPrismaClient.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-member-1',
          type: 'REQUEST_APPROVED',
          titleEn: 'Request Approved',
          link: '/requests/REQ-2026-0001',
        }),
      });

      expect(mockEmailProvider.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'member@example.com',
          subject: expect.stringContaining('Request Approved'),
        }),
      );
    });
  });
});
