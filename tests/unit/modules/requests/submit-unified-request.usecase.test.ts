import {
  PrismaClient,
  CatalogItemCategory,
  PricingModel,
  MembershipTier,
  MembershipStatus,
  EngagementRequestStatus,
} from '@prisma/client';
import { SubmitUnifiedRequestUseCase } from '../../../../src/modules/requests/application/submit-unified-request.usecase';
import {
  NotFoundError,
  AuthenticationError,
  ValidationError,
  ConflictError,
} from '../../../../src/shared/errors';

describe('SubmitUnifiedRequestUseCase Unit Tests (REQ-14, SEC-33)', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let useCase: SubmitUnifiedRequestUseCase;

  const mockCoreService = {
    id: 'item-service-1',
    slug: 'proposal-building',
    category: CatalogItemCategory.CORE_SERVICE,
    pricingModel: PricingModel.PERCENTAGE,
    nameEn: 'Proposal Building Support',
    nameAr: 'إعداد المقترحات',
    basePrice: 0,
    currency: 'USD',
    isActive: true,
  };

  const mockDiagnosticTool = {
    id: 'item-tool-1',
    slug: 'pqp',
    category: CatalogItemCategory.DIAGNOSTIC_TOOL,
    pricingModel: PricingModel.FREE_THEN_PAID,
    nameEn: 'PQP™ Assessment',
    nameAr: 'ملف PQP™',
    basePrice: 12000,
    currency: 'USD',
    isActive: true,
  };

  beforeEach(() => {
    mockPrisma = {
      catalogItem: {
        findFirst: jest.fn(),
      },
      member: {
        findUnique: jest.fn(),
      },
      engagementRequest: {
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
        return callback(mockPrisma);
      }),
    } as unknown as jest.Mocked<PrismaClient>;

    useCase = new SubmitUnifiedRequestUseCase(mockPrisma);
  });

  it('should fail with AuthenticationError if member not found', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      useCase.execute('invalid-user', { itemSlug: 'proposal-building' }, {}),
    ).rejects.toThrow(AuthenticationError);
  });

  it('should fail with NotFoundError if item slug does not exist', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      userId: 'user-1',
      memberships: [{ tier: MembershipTier.ESSENTIAL, status: MembershipStatus.ACTIVE }],
    });
    (mockPrisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(useCase.execute('user-1', { itemSlug: 'non-existent-slug' }, {})).rejects.toThrow(
      NotFoundError,
    );
  });

  it('should enforce REQ-14 active duplicate prevention with 409 ConflictError if open request exists', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      userId: 'user-1',
      memberships: [{ tier: MembershipTier.ESSENTIAL, status: MembershipStatus.ACTIVE }],
    });
    (mockPrisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(mockCoreService);
    (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue({
      referenceCode: 'REQ-2026-0001',
      status: EngagementRequestStatus.UNDER_REVIEW,
    });

    await expect(
      useCase.execute(
        'user-1',
        {
          itemSlug: 'proposal-building',
          brief: { project_value: 50000 },
          acknowledgement: true,
        },
        {},
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('should enforce REQ-14 duplicate prevention with 409 ConflictError if PAYMENT_CONFIRMED request exists (paid but unfulfilled)', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      userId: 'user-1',
      memberships: [{ tier: MembershipTier.ESSENTIAL, status: MembershipStatus.ACTIVE }],
    });
    (mockPrisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(mockCoreService);
    (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue({
      referenceCode: 'REQ-2026-0002',
      status: EngagementRequestStatus.PAYMENT_CONFIRMED,
    });

    await expect(
      useCase.execute(
        'user-1',
        {
          itemSlug: 'proposal-building',
          brief: { project_value: 50000 },
          acknowledgement: true,
        },
        {},
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('should fail with ValidationError if project_value is missing for PERCENTAGE pricingModel service', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      userId: 'user-1',
      memberships: [{ tier: MembershipTier.ESSENTIAL, status: MembershipStatus.ACTIVE }],
    });
    (mockPrisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(mockCoreService);
    (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      useCase.execute(
        'user-1',
        {
          itemSlug: 'proposal-building',
          brief: { description: 'Missing project_value' },
          acknowledgement: true,
        },
        {},
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('should successfully submit percentage-based service request when valid project_value provided', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      userId: 'user-1',
      memberships: [{ tier: MembershipTier.ESSENTIAL, status: MembershipStatus.ACTIVE }],
    });
    (mockPrisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(mockCoreService);
    (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(null);

    (mockPrisma.engagementRequest.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'req-service-1',
        createdAt: new Date('2026-04-01'),
        ...data,
      }),
    );

    const result = await useCase.execute(
      'user-1',
      {
        itemSlug: 'proposal-building',
        brief: { project_value: 50000, description: 'Complete training proposal' },
        acknowledgement: true,
      },
      { ipAddress: '127.0.0.1', requestId: 'req-track-1' },
    );

    expect(result.status).toBe(EngagementRequestStatus.UNDER_REVIEW);
    expect(result.pricingModel).toBe(PricingModel.PERCENTAGE);
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('should successfully submit diagnostic tool with free first use ($0, PAYMENT_CONFIRMED) for active member', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      userId: 'user-1',
      memberships: [{ tier: MembershipTier.PROFESSIONAL, status: MembershipStatus.ACTIVE }],
    });
    (mockPrisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(mockDiagnosticTool);
    (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(null); // No active duplicate
    (mockPrisma.engagementRequest.count as jest.Mock).mockResolvedValue(0); // 0 previous usages

    (mockPrisma.engagementRequest.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'req-tool-free',
        createdAt: new Date('2026-04-01'),
        ...data,
      }),
    );

    const result = await useCase.execute(
      'user-1',
      {
        itemSlug: 'pqp',
        brief: { assessmentEmail: 'trainee@example.com' },
        acknowledgement: true,
      },
      {},
    );

    expect(result.status).toBe(EngagementRequestStatus.PAYMENT_CONFIRMED);
    expect(result.finalPrice).toBe(0);
    expect(result.isFirstUseFreeApplied).toBe(true);
  });

  it('should reject requests for items with PricingModel.NONE as non-requestable', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      userId: 'user-1',
      memberships: [{ tier: MembershipTier.ESSENTIAL, status: MembershipStatus.ACTIVE }],
    });
    (mockPrisma.catalogItem.findFirst as jest.Mock).mockResolvedValue({
      id: 'item-none-1',
      slug: 'info-only-game',
      category: CatalogItemCategory.BUSINESS_SIMULATION,
      pricingModel: PricingModel.NONE,
      nameEn: 'Info-Only Simulation Game',
      nameAr: 'لعبة للمعلومات فقط',
      basePrice: 0,
      currency: 'USD',
      isActive: true,
    });

    await expect(
      useCase.execute(
        'user-1',
        {
          itemSlug: 'info-only-game',
          brief: {},
          acknowledgement: true,
        },
        {},
      ),
    ).rejects.toThrow(ValidationError);
  });
});
