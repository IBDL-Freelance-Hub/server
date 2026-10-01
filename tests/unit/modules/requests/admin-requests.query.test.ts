import {
  PrismaClient,
  CatalogItemCategory,
  EngagementRequestStatus,
  MembershipTier,
  MembershipStatus,
  PricingModel,
} from '@prisma/client';
import { AdminListRequestsUseCase } from '../../../../src/modules/requests/application/admin-list-requests.usecase';
import { AdminGetRequestByIdUseCase } from '../../../../src/modules/requests/application/admin-get-request-by-id.usecase';
import { NotFoundError } from '../../../../src/shared/errors';

describe('Admin Requests Query Refinement Unit Tests (Step 5)', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let listRequestsUseCase: AdminListRequestsUseCase;
  let getRequestByIdUseCase: AdminGetRequestByIdUseCase;

  const mockAdminRecord = {
    id: 'req-uuid-1',
    referenceCode: 'REQ-2026-0001',
    memberId: 'member-uuid-1',
    catalogItemId: 'catalog-item-1',
    category: CatalogItemCategory.CORE_SERVICE,
    pricingModel: PricingModel.FIXED,
    status: EngagementRequestStatus.UNDER_REVIEW,
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
    brief: { description: 'Staff evaluation required' },
    customRequirements: 'Custom brief',
    intakeData: null,
    adminNotes: 'Notes from staff',
    reviewNotes: null,
    rejectionReason: null,
    cancellationReason: null,
    paymentReference: 'PAY-12345',
    paidAt: new Date('2026-03-01T12:00:00Z'),
    infoRequestedAt: null,
    approvedAt: new Date('2026-03-01T11:00:00Z'),
    fulfilledAt: null,
    cancelledAt: null,
    rejectedAt: null,
    createdAt: new Date('2026-03-01T10:00:00Z'),
    updatedAt: new Date('2026-03-01T12:00:00Z'),
    member: {
      id: 'member-uuid-1',
      userId: 'user-uuid-1',
      fullNameEn: 'Sarah Connor',
      fullNameAr: 'سارة كونور',
      phone: '+971501234567',
      country: 'United Arab Emirates',
      user: {
        email: 'sarah.connor@example.com',
      },
    },
    catalogItem: {
      id: 'catalog-item-1',
      slug: 'trainer-accreditation',
      nameEn: 'Certified Associate Trainer',
      nameAr: 'مدرب مشارك معتمد',
      category: CatalogItemCategory.PROFESSIONAL_RECOGNITION,
      pricingModel: PricingModel.FIXED,
      basePrice: 25000,
      percentageRate: null,
    },
  };

  beforeEach(() => {
    mockPrisma = {
      engagementRequest: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      assessmentCredentialPool: {
        findFirst: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;

    listRequestsUseCase = new AdminListRequestsUseCase(mockPrisma);
    getRequestByIdUseCase = new AdminGetRequestByIdUseCase(mockPrisma);
  });

  describe('AdminListRequestsUseCase', () => {
    it('should list all requests with pagination and mapped fields', async () => {
      (mockPrisma.engagementRequest.count as jest.Mock).mockResolvedValue(1);
      (mockPrisma.engagementRequest.findMany as jest.Mock).mockResolvedValue([mockAdminRecord]);

      const result = await listRequestsUseCase.execute({ page: 1, limit: 10 });

      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]!.referenceCode).toBe('REQ-2026-0001');
      expect(result.requests[0]!.member.email).toBe('sarah.connor@example.com');
      expect(result.requests[0]!.catalogItem.nameEn).toBe('Certified Associate Trainer');
      expect(result.requests[0]!.pricing.finalPrice).toBe(8500);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should apply status, category, and memberId filters when provided', async () => {
      (mockPrisma.engagementRequest.count as jest.Mock).mockResolvedValue(1);
      (mockPrisma.engagementRequest.findMany as jest.Mock).mockResolvedValue([mockAdminRecord]);

      await listRequestsUseCase.execute({
        status: EngagementRequestStatus.UNDER_REVIEW,
        category: CatalogItemCategory.CORE_SERVICE,
        memberId: 'member-uuid-1',
      });

      expect(mockPrisma.engagementRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: EngagementRequestStatus.UNDER_REVIEW,
            category: CatalogItemCategory.CORE_SERVICE,
            memberId: 'member-uuid-1',
          }),
        }),
      );
    });

    it('should apply search across referenceCode, member name, and email', async () => {
      (mockPrisma.engagementRequest.count as jest.Mock).mockResolvedValue(1);
      (mockPrisma.engagementRequest.findMany as jest.Mock).mockResolvedValue([mockAdminRecord]);

      await listRequestsUseCase.execute({ search: 'REQ-2026' });

      expect(mockPrisma.engagementRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { referenceCode: { contains: 'REQ-2026', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });

  describe('AdminGetRequestByIdUseCase', () => {
    it('should return complete administrative request details by UUID or referenceCode', async () => {
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(mockAdminRecord);

      const result = await getRequestByIdUseCase.execute('REQ-2026-0001');

      expect(result.referenceCode).toBe('REQ-2026-0001');
      expect(result.member.phone).toBe('+971501234567');
      expect(result.member.country).toBe('United Arab Emirates');
      expect(result.pricing.finalPrice).toBe(8500);
      expect(result.brief).toEqual({ description: 'Staff evaluation required' });
      expect(result.paymentReference).toBe('PAY-12345');
    });

    it('should fetch assigned credentials if category is DIAGNOSTIC_TOOL', async () => {
      const toolRecord = {
        ...mockAdminRecord,
        category: CatalogItemCategory.DIAGNOSTIC_TOOL,
      };
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(toolRecord);
      (mockPrisma.assessmentCredentialPool.findFirst as jest.Mock).mockResolvedValue({
        id: 'cred-1',
        username: 'candidate_sarah',
        accessUrl: 'https://assess.ibdl.net',
        assignedAt: new Date('2026-03-01T12:00:00Z'),
      });

      const result = await getRequestByIdUseCase.execute('req-uuid-1');

      expect(result.assignedCredential).toBeDefined();
      expect(result.assignedCredential?.username).toBe('candidate_sarah');
    });

    it('should throw NotFoundError if request does not exist', async () => {
      (mockPrisma.engagementRequest.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(getRequestByIdUseCase.execute('NON-EXISTENT')).rejects.toThrow(NotFoundError);
    });
  });
});
