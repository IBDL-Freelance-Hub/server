import { PrismaClient, MembershipTier, MembershipStatus, UserStatus } from '@prisma/client';
import { GetMemberDashboardUseCase } from '../../../../src/modules/members/application/get-member-dashboard.usecase';
import { NotFoundError } from '../../../../src/shared/errors';

describe('GetMemberDashboardUseCase Unit Tests (SEC-33, MEM-01 to MEM-12, PRO-13, PRO-14)', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let useCase: GetMemberDashboardUseCase;

  const sampleDate = new Date('2026-01-01T00:00:00Z');
  const futureRenewalDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days in future

  const mockMember = {
    id: 'member-uuid-1',
    userId: 'user-uuid-1',
    fullNameEn: 'Jane Doe',
    fullNameAr: 'جين دو',
    phone: '+201012345678',
    phoneNormalized: '+201012345678',
    country: 'Egypt',
    city: 'Cairo',
    yearsOfExperience: '6-10',
    areasOfExpertise: ['FinTech', 'Backend'],
    industriesServed: ['Finance', 'Banking'],
    languages: ['Arabic', 'English'],
    bioEn: 'Senior backend specialist.',
    bioAr: 'أخصائية خوادم وقواعد بيانات.',
    linkedinUrl: 'https://linkedin.com/in/janedoe',
    photoFileId: 'photo-file-uuid',
    directoryOptIn: true,
    profileCompletionRate: 91,
    createdAt: sampleDate,
    updatedAt: sampleDate,
    user: {
      id: 'user-uuid-1',
      email: 'jane.doe@example.com',
      userType: 'MEMBER',
      status: UserStatus.ACTIVE,
      createdAt: sampleDate,
    },
    memberships: [
      {
        id: 'membership-uuid-1',
        memberId: 'member-uuid-1',
        tier: MembershipTier.PROFESSIONAL,
        status: MembershipStatus.ACTIVE,
        startDate: sampleDate,
        endDate: futureRenewalDate,
        price: 99.0,
        createdAt: sampleDate,
        updatedAt: sampleDate,
      },
    ],
    files: [
      {
        id: 'cv-file-uuid',
        category: 'CV',
        status: 'ACTIVE',
      },
    ],
  };

  const mockAuditLogs = [
    {
      id: 'log-uuid-1',
      action: 'MEMBER_PROFILE_UPDATED',
      resource: 'Member',
      resourceId: 'member-uuid-1',
      reason: 'User profile update',
      createdAt: new Date(),
    },
    {
      id: 'log-uuid-2',
      action: 'AUTH_PASSWORD_CHANGED',
      resource: 'User',
      resourceId: 'user-uuid-1',
      reason: null,
      createdAt: new Date(),
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      member: {
        findUnique: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;

    useCase = new GetMemberDashboardUseCase(mockPrisma);
  });

  it('should aggregate complete member dashboard payload with server-side entitlements and activity', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockMember);
    (mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockAuditLogs);

    const result = await useCase.execute('user-uuid-1');

    // 1. Member summary
    expect(result.member.id).toBe('member-uuid-1');
    expect(result.member.fullNameEn).toBe('Jane Doe');
    expect(result.member.email).toBe('jane.doe@example.com');
    expect(result.member.city).toBe('Cairo');
    expect(result.member.country).toBe('Egypt');
    expect(result.member.photoUrl).toBe('/api/v1/files/photo-file-uuid/download');

    // 2. Membership summary
    expect(result.membership.tier).toBe(MembershipTier.PROFESSIONAL);
    expect(result.membership.status).toBe(MembershipStatus.ACTIVE);
    expect(result.membership.daysUntilRenewal).toBeGreaterThanOrEqual(29);
    expect(result.membership.renewsOn).toEqual(futureRenewalDate);

    // 3. Entitlements calculation (SEC-33)
    expect(result.entitlements.tier).toBe(MembershipTier.PROFESSIONAL);
    expect(result.entitlements.benefits.discounts.platformDiscountPercentage).toBe(30);
    expect(result.entitlements.benefits.assessmentAccess.type).toBe('SINGLE_COMPLIMENTARY');
    expect(result.entitlements.benefits.directoryVisibility.badge).toBe('VERIFIED_PROFESSIONAL');
    expect(result.entitlements.benefits.directoryVisibility.listingType).toBe('PRIORITY');
    expect(result.entitlements.directoryEligibility.isEligible).toBe(true);

    // 4. Profile progress
    expect(result.profileProgress.completionPercentage).toBeGreaterThanOrEqual(80);

    // 5. Recent activity without BigInt serialization issue
    expect(result.recentActivity).toHaveLength(2);
    expect(result.recentActivity[0]?.action).toBe('MEMBER_PROFILE_UPDATED');
    // Ensure payload can be JSON-stringified without throwing BigInt TypeError
    expect(() => JSON.stringify(result)).not.toThrow();

    // Verify DB call strictly omits BigInt sequenceNumber
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { actorId: 'user-uuid-1' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        reason: true,
        createdAt: true,
      },
    });
  });

  it('should throw NotFoundError when member does not exist', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(useCase.execute('non-existent-user')).rejects.toThrow(NotFoundError);
  });

  it('should return null photoUrl when member has no photoFileId', async () => {
    const memberNoPhoto = {
      ...mockMember,
      photoFileId: null,
    };
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(memberNoPhoto);
    (mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

    const result = await useCase.execute('user-uuid-1');

    expect(result.member.photoUrl).toBeNull();
  });

  it('should handle fallback when member has no membership records', async () => {
    const memberNoMembership = {
      ...mockMember,
      memberships: [],
    };
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(memberNoMembership);
    (mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

    const result = await useCase.execute('user-uuid-1');

    expect(result.membership.tier).toBe(MembershipTier.ESSENTIAL);
    expect(result.membership.status).toBe(MembershipStatus.ACTIVE);
    expect(result.membership.renewsOn).toBeNull();
    expect(result.membership.daysUntilRenewal).toBe(0);
    expect(result.entitlements.benefits.discounts.platformDiscountPercentage).toBe(15);
  });

  it('should calculate 0 daysUntilRenewal when membership renewal date has passed', async () => {
    const pastRenewalDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const memberExpired = {
      ...mockMember,
      memberships: [
        {
          ...mockMember.memberships[0],
          status: MembershipStatus.EXPIRED,
          endDate: pastRenewalDate,
        },
      ],
    };
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(memberExpired);
    (mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

    const result = await useCase.execute('user-uuid-1');

    expect(result.membership.daysUntilRenewal).toBe(0);
    expect(result.entitlements.isActive).toBe(false);
    expect(result.entitlements.benefits.discounts.platformDiscountPercentage).toBe(0);
    expect(result.entitlements.directoryEligibility.isEligible).toBe(false);
  });
});
