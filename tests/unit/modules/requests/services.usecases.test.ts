import {
  PrismaClient,
  CatalogItemCategory,
  MembershipTier,
  MembershipStatus,
  EngagementRequestStatus,
} from '@prisma/client';
import { ListCoreServicesUseCase } from '../../../../src/modules/requests/application/list-core-services.usecase';
import { RequestCoreServiceUseCase } from '../../../../src/modules/requests/application/request-core-service.usecase';
import { NotFoundError, AuthenticationError } from '../../../../src/shared/errors';

describe('Services Use Cases Unit Tests (MEM-13, SEC-33)', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let listServicesUseCase: ListCoreServicesUseCase;
  let requestServiceUseCase: RequestCoreServiceUseCase;

  const mockServiceItem = {
    id: 'service-uuid-1',
    slug: 'training-needs-analysis',
    category: CatalogItemCategory.CORE_SERVICE,
    nameEn: 'Training Needs Analysis (TNA) Assistance',
    nameAr: 'المساعدة في تحليل الاحتياجات التدريبية',
    descriptionEn: 'TNA consulting support',
    descriptionAr: null,
    basePrice: 15000,
    currency: 'USD',
    isActive: true,
    metadata: { durationDays: 7 },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    mockPrisma = {
      catalogItem: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      member: {
        findUnique: jest.fn(),
      },
      engagementRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
        return callback(mockPrisma);
      }),
    } as unknown as jest.Mocked<PrismaClient>;

    listServicesUseCase = new ListCoreServicesUseCase(mockPrisma);
    requestServiceUseCase = new RequestCoreServiceUseCase(mockPrisma);
  });

  describe('ListCoreServicesUseCase', () => {
    it('should list services with unauthenticated guest baseline (0% discount)', async () => {
      (mockPrisma.catalogItem.findMany as jest.Mock).mockResolvedValue([mockServiceItem]);

      const result = await listServicesUseCase.execute();

      expect(result).toHaveLength(1);
      expect(result[0]!.slug).toBe('training-needs-analysis');
      expect(result[0]!.basePrice).toBe(15000);
      expect(result[0]!.discountPercentage).toBe(0.0);
      expect(result[0]!.finalPrice).toBe(15000);
      expect(result[0]!.isIncludedWithPlan).toBe(false);
    });

    it('should list services with Essential member 15% discount', async () => {
      (mockPrisma.catalogItem.findMany as jest.Mock).mockResolvedValue([mockServiceItem]);
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-1',
        userId: 'user-1',
        memberships: [{ tier: MembershipTier.ESSENTIAL, status: MembershipStatus.ACTIVE }],
      });

      const result = await listServicesUseCase.execute('user-1');

      expect(result[0]!.discountPercentage).toBe(15.0);
      expect(result[0]!.finalPrice).toBe(12750);
      expect(result[0]!.isIncludedWithPlan).toBe(false);
    });

    it('should list services with Master member complimentary 100% discount ($0.00 finalPrice)', async () => {
      (mockPrisma.catalogItem.findMany as jest.Mock).mockResolvedValue([mockServiceItem]);
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-master',
        userId: 'user-master',
        memberships: [{ tier: MembershipTier.MASTER, status: MembershipStatus.ACTIVE }],
      });

      const result = await listServicesUseCase.execute('user-master');

      expect(result[0]!.discountPercentage).toBe(100.0);
      expect(result[0]!.finalPrice).toBe(0.0);
      expect(result[0]!.isIncludedWithPlan).toBe(true);
    });
  });

  describe('RequestCoreServiceUseCase', () => {
    it('should fail with AuthenticationError if member not found', async () => {
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        requestServiceUseCase.execute('unknown-user', 'training-needs-analysis', {}, {}),
      ).rejects.toThrow(AuthenticationError);
    });

    it('should fail with NotFoundError if service slug does not exist', async () => {
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-1',
        userId: 'user-1',
        memberships: [{ tier: MembershipTier.ESSENTIAL, status: MembershipStatus.ACTIVE }],
      });
      (mockPrisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(requestServiceUseCase.execute('user-1', 'invalid-slug', {}, {})).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should create service request with IN_REVIEW status immediately for Master active members ($0.00 finalPrice)', async () => {
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-master',
        userId: 'user-master',
        memberships: [{ tier: MembershipTier.MASTER, status: MembershipStatus.ACTIVE }],
      });
      (mockPrisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(mockServiceItem);

      (mockPrisma.engagementRequest.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'request-uuid-1',
          createdAt: new Date('2026-03-01T10:00:00Z'),
          ...data,
        }),
      );

      const result = await requestServiceUseCase.execute(
        'user-master',
        'training-needs-analysis',
        { customRequirements: 'Urgent learning architecture required' },
        { ipAddress: '127.0.0.1', requestId: 'req-test-1' },
      );

      expect(result.status).toBe(EngagementRequestStatus.UNDER_REVIEW);
      expect(result.finalPrice).toBe(0);
      expect(result.isIncludedWithPlan).toBe(true);
      expect(result.referenceCode).toMatch(/^REQ-\d{4}-\d+$/);
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should create service request with AWAITING_PAYMENT status for Professional member requiring payment', async () => {
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-pro',
        userId: 'user-pro',
        memberships: [{ tier: MembershipTier.PROFESSIONAL, status: MembershipStatus.ACTIVE }],
      });
      (mockPrisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(mockServiceItem);

      (mockPrisma.engagementRequest.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'request-uuid-2',
          createdAt: new Date('2026-03-01T10:00:00Z'),
          ...data,
        }),
      );

      const result = await requestServiceUseCase.execute(
        'user-pro',
        'training-needs-analysis',
        {},
        { ipAddress: '127.0.0.1', requestId: 'req-test-2' },
      );

      expect(result.status).toBe(EngagementRequestStatus.AWAITING_PAYMENT);
      expect(result.discountPercentage).toBe(30.0);
      expect(result.finalPrice).toBe(10500);
      expect(result.isIncludedWithPlan).toBe(false);
    });
  });
});
