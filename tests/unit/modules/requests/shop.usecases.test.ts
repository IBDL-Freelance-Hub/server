import {
  PrismaClient,
  CatalogItemCategory,
  PricingModel,
  MembershipTier,
  MembershipStatus,
  EngagementRequestStatus,
} from '@prisma/client';
import { ListDiagnosticToolsUseCase } from '../../../../src/modules/requests/application/list-diagnostic-tools.usecase';
import { OrderDiagnosticToolUseCase } from '../../../../src/modules/requests/application/order-diagnostic-tool.usecase';
import { NotFoundError } from '../../../../src/shared/errors';

describe('Diagnostic Tools Shop Use Cases Unit Tests (MEM-14, MEM-16, MEM-76)', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let listToolsUseCase: ListDiagnosticToolsUseCase;
  let orderToolUseCase: OrderDiagnosticToolUseCase;

  const mockToolItem = {
    id: 'tool-uuid-pqp',
    slug: 'pqp',
    category: CatalogItemCategory.DIAGNOSTIC_TOOL,
    pricingModel: PricingModel.FREE_THEN_PAID,
    packageLevel: 'LEVEL_1',
    nameEn: 'PQP™ - Professional Qualifications Profile',
    nameAr: 'ملف المؤهلات المهنية PQP™',
    descriptionEn: 'Psychometric profiling',
    descriptionAr: null,
    basePrice: 12000,
    currency: 'USD',
    percentageRate: null,
    isActive: true,
    metadata: { instrument: 'PQP' },
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
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
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

    listToolsUseCase = new ListDiagnosticToolsUseCase(mockPrisma);
    orderToolUseCase = new OrderDiagnosticToolUseCase(mockPrisma);
  });

  describe('ListDiagnosticToolsUseCase', () => {
    it('should show free first use ($0, 100% discount) for Essential member who has not used tool before', async () => {
      (mockPrisma.catalogItem.findMany as jest.Mock).mockResolvedValue([mockToolItem]);
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-essential',
        userId: 'user-essential',
        memberships: [{ tier: MembershipTier.ESSENTIAL, status: MembershipStatus.ACTIVE }],
      });
      (mockPrisma.engagementRequest.findMany as jest.Mock).mockResolvedValue([]);

      const result = await listToolsUseCase.execute('user-essential');

      expect(result).toHaveLength(1);
      expect(result[0]!.quarterlyEntitlementStatus).toBe('INELIGIBLE');
      expect(result[0]!.isFirstUseFree).toBe(true);
      expect(result[0]!.discountPercentage).toBe(100.0);
      expect(result[0]!.finalPrice).toBe(0);
    });

    it('should charge 15% discount for Essential member who has already used this tool before', async () => {
      (mockPrisma.catalogItem.findMany as jest.Mock).mockResolvedValue([mockToolItem]);
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-essential',
        userId: 'user-essential',
        memberships: [{ tier: MembershipTier.ESSENTIAL, status: MembershipStatus.ACTIVE }],
      });
      (mockPrisma.engagementRequest.findMany as jest.Mock).mockResolvedValue([
        { catalogItemId: 'tool-uuid-pqp' },
      ]);

      const result = await listToolsUseCase.execute('user-essential');

      expect(result).toHaveLength(1);
      expect(result[0]!.quarterlyEntitlementStatus).toBe('INELIGIBLE');
      expect(result[0]!.isFirstUseFree).toBe(false);
      expect(result[0]!.discountPercentage).toBe(15.0);
      expect(result[0]!.finalPrice).toBe(10200);
    });

    it('should show AVAILABLE quarterly entitlement for active Master member who has consumed first use but has 0 quarter usages', async () => {
      (mockPrisma.catalogItem.findMany as jest.Mock).mockResolvedValue([mockToolItem]);
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-master',
        userId: 'user-master',
        memberships: [
          {
            tier: MembershipTier.MASTER,
            status: MembershipStatus.ACTIVE,
            startDate: new Date('2026-01-01'),
          },
        ],
      });
      // Already used once in lifetime
      (mockPrisma.engagementRequest.findMany as jest.Mock).mockResolvedValue([
        { catalogItemId: 'tool-uuid-pqp' },
      ]);
      // 0 usages in current contractual quarter
      (mockPrisma.engagementRequest.count as jest.Mock).mockResolvedValue(0);

      const result = await listToolsUseCase.execute('user-master');

      expect(result[0]!.quarterlyEntitlementStatus).toBe('AVAILABLE');
      expect(result[0]!.isFirstUseFree).toBe(false);
      expect(result[0]!.discountPercentage).toBe(100.0);
      expect(result[0]!.finalPrice).toBe(0);
    });

    it('should show USED quarterly entitlement and 40% discount for active Master member with 1 usage in quarter and first use consumed', async () => {
      (mockPrisma.catalogItem.findMany as jest.Mock).mockResolvedValue([mockToolItem]);
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-master',
        userId: 'user-master',
        memberships: [
          {
            tier: MembershipTier.MASTER,
            status: MembershipStatus.ACTIVE,
            startDate: new Date('2026-01-01'),
          },
        ],
      });
      (mockPrisma.engagementRequest.findMany as jest.Mock).mockResolvedValue([
        { catalogItemId: 'tool-uuid-pqp' },
      ]);
      (mockPrisma.engagementRequest.count as jest.Mock).mockResolvedValue(1);

      const result = await listToolsUseCase.execute('user-master');

      expect(result[0]!.quarterlyEntitlementStatus).toBe('USED');
      expect(result[0]!.isFirstUseFree).toBe(false);
      expect(result[0]!.discountPercentage).toBe(40.0);
      expect(result[0]!.finalPrice).toBe(7200); // 12000 - 40%
    });
  });

  describe('OrderDiagnosticToolUseCase', () => {
    it('should fail with NotFoundError if tool slug not found', async () => {
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-1',
        userId: 'user-1',
        memberships: [
          { tier: MembershipTier.MASTER, status: MembershipStatus.ACTIVE, startDate: new Date() },
        ],
      });
      (mockPrisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(orderToolUseCase.execute('user-1', 'unknown-tool', {}, {})).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should apply free first use ($0, PAYMENT_CONFIRMED) for Essential member on their first tool order', async () => {
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-essential',
        userId: 'user-essential',
        memberships: [{ tier: MembershipTier.ESSENTIAL, status: MembershipStatus.ACTIVE }],
      });
      (mockPrisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(mockToolItem);
      // 0 previous usages of this tool
      (mockPrisma.engagementRequest.count as jest.Mock).mockResolvedValue(0);

      (mockPrisma.engagementRequest.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'req-tool-first',
          createdAt: new Date('2026-02-01'),
          ...data,
        }),
      );

      const result = await orderToolUseCase.execute(
        'user-essential',
        'pqp',
        { intakeData: { assessmentEmail: 'trainee@example.com' } },
        { ipAddress: '127.0.0.1', requestId: 'req-order-first' },
      );

      expect(result.status).toBe(EngagementRequestStatus.PAYMENT_CONFIRMED);
      expect(result.finalPrice).toBe(0);
      expect(result.isFirstUseFreeApplied).toBe(true);
      expect(result.isQuarterlyEntitlementApplied).toBe(false);
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should charge 15% discounted price with AWAITING_PAYMENT for Essential member on second order of same tool', async () => {
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-essential',
        userId: 'user-essential',
        memberships: [{ tier: MembershipTier.ESSENTIAL, status: MembershipStatus.ACTIVE }],
      });
      (mockPrisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(mockToolItem);
      // 1 previous usage of this tool
      (mockPrisma.engagementRequest.count as jest.Mock).mockResolvedValue(1);

      (mockPrisma.engagementRequest.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'req-tool-second',
          createdAt: new Date('2026-02-10'),
          ...data,
        }),
      );

      const result = await orderToolUseCase.execute(
        'user-essential',
        'pqp',
        {},
        { ipAddress: '127.0.0.1', requestId: 'req-order-second' },
      );

      expect(result.status).toBe(EngagementRequestStatus.AWAITING_PAYMENT);
      expect(result.discountPercentage).toBe(15.0);
      expect(result.finalPrice).toBe(10200);
      expect(result.isFirstUseFreeApplied).toBe(false);
    });

    it('should apply quarterly complimentary entitlement for Master member on order after first use already consumed', async () => {
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-master',
        userId: 'user-master',
        memberships: [
          {
            tier: MembershipTier.MASTER,
            status: MembershipStatus.ACTIVE,
            startDate: new Date('2026-01-01'),
          },
        ],
      });
      (mockPrisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(mockToolItem);

      (mockPrisma.engagementRequest.count as jest.Mock).mockImplementation(({ where }) => {
        if (where?.isQuarterlyEntitlement) {
          return Promise.resolve(0); // 0 quarterly usages (quarterly entitlement available)
        }
        return Promise.resolve(1); // 1 previous tool usage (first use consumed)
      });

      (mockPrisma.engagementRequest.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'req-tool-1',
          createdAt: new Date('2026-02-01'),
          ...data,
        }),
      );

      const result = await orderToolUseCase.execute(
        'user-master',
        'pqp',
        { intakeData: { assessmentEmail: 'trainee@example.com' } },
        { ipAddress: '127.0.0.1', requestId: 'req-order-1' },
      );

      expect(result.status).toBe(EngagementRequestStatus.PAYMENT_CONFIRMED);
      expect(result.finalPrice).toBe(0);
      expect(result.isQuarterlyEntitlementApplied).toBe(true);
      expect(result.isFirstUseFreeApplied).toBe(false);
      expect(result.quarterIndex).toBe(4);
      expect(result.membershipYear).toBe(1);
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should charge 40% discounted price with AWAITING_PAYMENT for Master member when both first-use and quarterly entitlement are consumed', async () => {
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
        id: 'member-master',
        userId: 'user-master',
        memberships: [
          {
            tier: MembershipTier.MASTER,
            status: MembershipStatus.ACTIVE,
            startDate: new Date('2026-01-01'),
          },
        ],
      });
      (mockPrisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(mockToolItem);
      // Both quarterly and previous tool usages are > 0
      (mockPrisma.engagementRequest.count as jest.Mock).mockResolvedValue(1);

      (mockPrisma.engagementRequest.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'req-tool-2',
          createdAt: new Date('2026-02-15'),
          ...data,
        }),
      );

      const result = await orderToolUseCase.execute(
        'user-master',
        'pqp',
        {},
        { ipAddress: '127.0.0.1', requestId: 'req-order-2' },
      );

      expect(result.status).toBe(EngagementRequestStatus.AWAITING_PAYMENT);
      expect(result.discountPercentage).toBe(40.0);
      expect(result.finalPrice).toBe(7200);
      expect(result.isQuarterlyEntitlementApplied).toBe(false);
      expect(result.isFirstUseFreeApplied).toBe(false);
    });
  });
});
