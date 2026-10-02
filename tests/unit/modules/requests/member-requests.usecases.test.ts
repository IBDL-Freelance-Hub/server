import {
  PrismaClient,
  CatalogItemCategory,
  EngagementRequestStatus,
  MembershipTier,
  MembershipStatus,
  PricingModel,
} from '@prisma/client';
import { ListMemberRequestsUseCase } from '../../../../src/modules/requests/application/list-member-requests.usecase';
import { GetMemberRequestByRefUseCase } from '../../../../src/modules/requests/application/get-member-request-by-ref.usecase';
import { CancelMemberRequestUseCase } from '../../../../src/modules/requests/application/cancel-member-request.usecase';
import { RespondInfoMemberRequestUseCase } from '../../../../src/modules/requests/application/respond-info-member-request.usecase';
import { IRequestNotificationService } from '../../../../src/modules/requests/application/services/request-notification.service';
import { NotFoundError, BusinessRuleError } from '../../../../src/shared/errors';

describe('Member Requests, Tracking & Cancellation Unit Tests (Step 5)', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockNotificationSvc: jest.Mocked<IRequestNotificationService>;
  let listRequestsUseCase: ListMemberRequestsUseCase;
  let getRequestByRefUseCase: GetMemberRequestByRefUseCase;
  let cancelRequestUseCase: CancelMemberRequestUseCase;
  let respondInfoUseCase: RespondInfoMemberRequestUseCase;

  const mockRequestRecord = {
    id: 'req-uuid-1',
    referenceCode: 'REQ-2026-A8K2',
    memberId: 'member-uuid-1',
    catalogItemId: 'catalog-item-1',
    category: CatalogItemCategory.CORE_SERVICE,
    pricingModel: PricingModel.INCLUDED_OR_QUOTED,
    status: EngagementRequestStatus.UNDER_REVIEW,
    tierAtRequest: MembershipTier.MASTER,
    membershipStatusAtRequest: MembershipStatus.ACTIVE,
    standardPrice: 15000,
    baseAmount: null,
    basePrice: 15000,
    discountPercentage: 100.0,
    discountAmount: 15000,
    finalPrice: 0,
    currency: 'USD',
    isQuarterlyEntitlement: false,
    quarterIndex: null,
    membershipYear: null,
    brief: { description: 'TNA consulting support needed' },
    customRequirements: 'Custom TNA requirements',
    intakeData: null,
    reviewNotes: null,
    cancellationReason: null,
    rejectionReason: null,
    paymentReference: null,
    paidAt: null,
    infoRequestedAt: null,
    approvedAt: null,
    fulfilledAt: null,
    cancelledAt: null,
    rejectedAt: null,
    createdAt: new Date('2026-03-01T10:00:00Z'),
    updatedAt: new Date('2026-03-01T10:00:00Z'),
    member: {
      id: 'member-uuid-1',
      userId: 'user-uuid-1',
      user: {
        email: 'member@example.com',
      },
    },
    catalogItem: {
      id: 'catalog-item-1',
      slug: 'training-needs-analysis',
      nameEn: 'Training Needs Analysis (TNA) Assistance',
      nameAr: 'المساعدة في تحليل الاحتياجات التدريبية',
      descriptionEn: 'TNA consulting support',
    },
  };

  beforeEach(() => {
    mockNotificationSvc = {
      dispatchNotification: jest.fn().mockResolvedValue({
        id: 'notif-1',
        userId: 'user-uuid-1',
        referenceCode: 'REQ-2026-A8K2',
        type: 'REQUEST_CANCELLED',
        titleEn: 'Request Cancelled',
        titleAr: 'تم إلغاء الطلب',
        messageEn: 'Cancelled',
        messageAr: 'ملغى',
        createdAt: new Date(),
        isRead: false,
      }),
      dispatchEmailOnly: jest.fn().mockResolvedValue(undefined),
      saveInAppNotification: jest.fn().mockResolvedValue(undefined),
      getInAppNotificationsForUser: jest.fn().mockResolvedValue([]),
    };

    mockPrisma = {
      member: {
        findUnique: jest.fn(),
      },
      engagementRequest: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
      },
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
        return callback(mockPrisma);
      }),
    } as unknown as jest.Mocked<PrismaClient>;

    listRequestsUseCase = new ListMemberRequestsUseCase(mockPrisma);
    getRequestByRefUseCase = new GetMemberRequestByRefUseCase(mockPrisma);
    cancelRequestUseCase = new CancelMemberRequestUseCase(mockPrisma, mockNotificationSvc);
    respondInfoUseCase = new RespondInfoMemberRequestUseCase(mockPrisma, mockNotificationSvc);
  });

  describe('1. ListMemberRequestsUseCase (Tenant Isolation & Enriched Query)', () => {
    it('should list requests scoped strictly to authenticated member (Tenant Isolation)', async () => {
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({ id: 'member-uuid-1' });
      (mockPrisma.engagementRequest.count as jest.Mock).mockResolvedValue(1);
      (mockPrisma.engagementRequest.findMany as jest.Mock).mockResolvedValue([mockRequestRecord]);

      const result = await listRequestsUseCase.execute('user-uuid-1', { page: 1, limit: 10 });

      expect(mockPrisma.engagementRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ memberId: 'member-uuid-1' }),
        }),
      );
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]!.referenceCode).toBe('REQ-2026-A8K2');
      expect(result.requests[0]!.timestamps.createdAt).toBe(
        mockRequestRecord.createdAt.toISOString(),
      );
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should mark PERCENTAGE service under review as pending approval with finalPrice null', async () => {
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({ id: 'member-uuid-1' });
      const pendingPercentageReq = {
        ...mockRequestRecord,
        pricingModel: PricingModel.PERCENTAGE,
        status: EngagementRequestStatus.SUBMITTED,
        finalPrice: 0, // In DB it might default to 0 before approval
        brief: { project_value: 50000, description: 'Percentage project' },
      };
      (mockPrisma.engagementRequest.count as jest.Mock).mockResolvedValue(1);
      (mockPrisma.engagementRequest.findMany as jest.Mock).mockResolvedValue([
        pendingPercentageReq,
      ]);

      const result = await listRequestsUseCase.execute('user-uuid-1', {});

      expect(result.requests[0]!.isQuotePending).toBe(true);
      expect(result.requests[0]!.quoteStatus).toBe('PENDING_APPROVAL');
      expect(result.requests[0]!.finalPrice).toBeNull();
    });

    it('should preserve and display cancelled or rejected requests (MEM-78f: No silent disappearance)', async () => {
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({ id: 'member-uuid-1' });
      const cancelledReq = {
        ...mockRequestRecord,
        status: EngagementRequestStatus.CANCELLED,
        cancellationReason: 'Cancelled by member',
      };
      (mockPrisma.engagementRequest.count as jest.Mock).mockResolvedValue(1);
      (mockPrisma.engagementRequest.findMany as jest.Mock).mockResolvedValue([cancelledReq]);

      const result = await listRequestsUseCase.execute('user-uuid-1', {
        status: EngagementRequestStatus.CANCELLED,
      });

      expect(result.requests[0]!.status).toBe(EngagementRequestStatus.CANCELLED);
    });
  });

  describe('2. GetMemberRequestByRefUseCase (Enriched Details & Quote Status)', () => {
    it('should return enriched request details including timestamps, brief, and pricing breakdown', async () => {
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(mockRequestRecord);

      const result = await getRequestByRefUseCase.execute('user-uuid-1', 'REQ-2026-A8K2');

      expect(result.referenceCode).toBe('REQ-2026-A8K2');
      expect(result.status).toBe(EngagementRequestStatus.UNDER_REVIEW);
      expect(result.catalogItem.slug).toBe('training-needs-analysis');
      expect(result.intake.brief).toEqual({ description: 'TNA consulting support needed' });
      expect(result.timestamps.createdAt).toBe(mockRequestRecord.createdAt.toISOString());
      expect(result.pricing.isQuotePending).toBe(false);
      expect(result.pricing.quoteStatus).toBe('CONFIRMED');
    });

    it('should display quote as PENDING_APPROVAL with null prices for QUOTED item under review', async () => {
      const quotedUnderReview = {
        ...mockRequestRecord,
        pricingModel: PricingModel.QUOTED,
        status: EngagementRequestStatus.UNDER_REVIEW,
        basePrice: 0,
        finalPrice: 0,
      };
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(quotedUnderReview);

      const result = await getRequestByRefUseCase.execute('user-uuid-1', 'REQ-2026-A8K2');

      expect(result.pricing.isQuotePending).toBe(true);
      expect(result.pricing.quoteStatus).toBe('PENDING_APPROVAL');
      expect(result.pricing.finalPrice).toBeNull();
      expect(result.pricing.quoteNote?.en).toContain('pending operational review');
    });

    it('should throw NotFoundError if another user attempts to access request (Tenant Isolation)', async () => {
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(mockRequestRecord);

      await expect(
        getRequestByRefUseCase.execute('user-attacker', 'REQ-2026-A8K2'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if request does not exist', async () => {
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(getRequestByRefUseCase.execute('user-uuid-1', 'REQ-2026-XXXX')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('3. CancelMemberRequestUseCase (Domain Rule canMemberCancelRequest & Side-Effects)', () => {
    it.each([
      EngagementRequestStatus.SUBMITTED,
      EngagementRequestStatus.UNDER_REVIEW,
      EngagementRequestStatus.AWAITING_RESPONSE,
      EngagementRequestStatus.AWAITING_PAYMENT,
    ])('should allow member to cancel request in %s status', async (status) => {
      const reqRecord = {
        ...mockRequestRecord,
        status,
      };
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(reqRecord);
      (mockPrisma.engagementRequest.update as jest.Mock).mockResolvedValue({
        ...reqRecord,
        status: EngagementRequestStatus.CANCELLED,
        cancellationReason: 'Need to postpone',
        cancelledAt: new Date(),
      });

      const result = await cancelRequestUseCase.execute(
        'user-uuid-1',
        reqRecord.referenceCode,
        { reason: 'Need to postpone' },
        { ipAddress: '127.0.0.1', requestId: 'req-cancel-1' },
      );

      expect(result.status).toBe(EngagementRequestStatus.CANCELLED);
      expect(result.cancellationReason).toBe('Need to postpone');

      // Staff/System AuditLog with actorRole MEMBER
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'user-uuid-1',
            actorRole: 'MEMBER',
            action: 'CANCEL_ENGAGEMENT_REQUEST',
            resource: 'EngagementRequest',
          }),
        }),
      );

      // Member Activity Feed Timeline Entry
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'user-uuid-1',
            actorRole: 'MEMBER',
            action: 'REQUEST_CANCELLED',
          }),
        }),
      );

      // Member notification dispatched
      expect(mockNotificationSvc.saveInAppNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-uuid-1',
          type: 'REQUEST_CANCELLED',
        }),
      );
    });

    it.each([
      EngagementRequestStatus.PAYMENT_CONFIRMED,
      EngagementRequestStatus.FULFILLED,
      EngagementRequestStatus.REJECTED,
      EngagementRequestStatus.CANCELLED,
    ])(
      'should forbid cancellation of request in %s status (throw BusinessRuleError 422)',
      async (forbiddenStatus) => {
        const forbiddenReq = {
          ...mockRequestRecord,
          status: forbiddenStatus,
        };
        (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(forbiddenReq);

        await expect(
          cancelRequestUseCase.execute('user-uuid-1', forbiddenReq.referenceCode, {}, {}),
        ).rejects.toThrow(BusinessRuleError);
      },
    );

    it('should throw NotFoundError if request to cancel does not exist or belongs to another member', async () => {
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        cancelRequestUseCase.execute('user-uuid-1', 'NON-EXISTENT', {}, {}),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('4. RespondInfoMemberRequestUseCase (State Transition & Notification)', () => {
    it('should transition from AWAITING_RESPONSE to UNDER_REVIEW and dispatch bilingual notification', async () => {
      const awaitingReq = {
        ...mockRequestRecord,
        status: EngagementRequestStatus.AWAITING_RESPONSE,
        reviewNotes: '[Admin Note]: Please provide details',
      };
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(awaitingReq);
      (mockPrisma.engagementRequest.update as jest.Mock).mockImplementation(
        async ({ data }: { data: unknown }) => ({
          ...awaitingReq,
          ...(data as object),
        }),
      );

      const result = await respondInfoUseCase.execute(
        'user-uuid-1',
        'REQ-2026-A8K2',
        {
          responseNotes: 'Here is the requested additional information',
          updatedBrief: { additionalRequirement: 'Extra detail' },
        },
        { ipAddress: '127.0.0.1', requestId: 'req-trace-123' },
      );

      expect(result.status).toBe(EngagementRequestStatus.UNDER_REVIEW);
      expect(result.referenceCode).toBe('REQ-2026-A8K2');

      // Audit Log for member action
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'user-uuid-1',
            actorRole: 'MEMBER',
            action: 'MEMBER_PROVIDED_INFO',
            resource: 'EngagementRequest',
          }),
        }),
      );

      // Member Activity Feed entry
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'user-uuid-1',
            actorRole: 'MEMBER',
            action: 'REQUEST_INFO_PROVIDED',
            resource: 'EngagementRequest',
          }),
        }),
      );

      // Bilingual Notification dispatch verification
      expect(mockNotificationSvc.saveInAppNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-uuid-1',
          referenceCode: 'REQ-2026-A8K2',
          type: 'REQUEST_INFO_PROVIDED',
          titleEn: 'Information Submitted',
          titleAr: 'تم تقديم المعلومات المطلوبة',
          messageEn: expect.stringContaining('back under review'),
          messageAr: expect.stringContaining('قيد المراجعة مجدداً'),
          link: '/requests/REQ-2026-A8K2',
        }),
      );
    });

    it('should forbid responding if request status is not AWAITING_RESPONSE', async () => {
      const notAwaitingReq = {
        ...mockRequestRecord,
        status: EngagementRequestStatus.UNDER_REVIEW,
      };
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(notAwaitingReq);

      await expect(
        respondInfoUseCase.execute('user-uuid-1', notAwaitingReq.referenceCode, {
          responseNotes: 'Extra note',
        }),
      ).rejects.toThrow(BusinessRuleError);
    });

    it('should throw NotFoundError if request does not exist or belongs to another user', async () => {
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        respondInfoUseCase.execute('user-uuid-1', 'NON-EXISTENT', {
          responseNotes: 'Extra note',
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
