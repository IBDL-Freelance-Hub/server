import { PrismaClient, MembershipTier, MembershipStatus, UserStatus } from '@prisma/client';
import { GetPublicTrainerProfileUseCase } from '../../../../src/modules/directory/application/get-public-trainer-profile.usecase';
import { NotFoundError } from '../../../../src/shared/errors';

describe('GetPublicTrainerProfileUseCase Unit Tests', () => {
  let mockPrisma: {
    member: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let useCase: GetPublicTrainerProfileUseCase;

  function createMockMember(overrides: Record<string, unknown> = {}) {
    const defaultMember = {
      id: 'd3b07384-d113-46fb-97c3-30514a6012e5',
      userId: 'user-uuid-1',
      fullNameEn: 'Hassan Mahmoud',
      fullNameAr: 'حسن محمود',
      phone: '+201012345678',
      phoneNormalized: '+201012345678',
      country: 'Egypt',
      city: 'Cairo',
      yearsOfExperience: '6-10',
      areasOfExpertise: ['Node.js', 'PostgreSQL'],
      industriesServed: ['FinTech', 'Logistics'],
      languages: ['Arabic', 'English'],
      bioEn: 'Experienced software architect and corporate trainer.',
      bioAr: 'مهندس معماري برمجيات ومدرب شركات معتمد.',
      linkedinUrl: 'https://linkedin.com/in/hassanmahmoud',
      photoFileId: 'photo-uuid-1',
      directoryOptIn: true,
      profileCompletionRate: 100,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
      user: {
        id: 'user-uuid-1',
        email: 'hassan@example.com',
        userType: 'MEMBER',
        status: UserStatus.ACTIVE,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      memberships: [
        {
          id: 'membership-uuid-1',
          tier: MembershipTier.PROFESSIONAL,
          status: MembershipStatus.ACTIVE,
          startDate: new Date('2026-01-01T00:00:00Z'),
          endDate: new Date('2027-01-01T00:00:00Z'),
        },
      ],
      files: [
        {
          id: 'file-cv-1',
          category: 'CV',
          status: 'ACTIVE',
          originalName: 'hassan-cv.pdf',
          sizeBytes: 1048576,
          mimeType: 'application/pdf',
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ],
    };

    return {
      ...defaultMember,
      ...overrides,
      user: overrides.user
        ? { ...defaultMember.user, ...(overrides.user as Record<string, unknown>) }
        : defaultMember.user,
      memberships:
        overrides.memberships !== undefined ? overrides.memberships : defaultMember.memberships,
      files: overrides.files !== undefined ? overrides.files : defaultMember.files,
    };
  }

  beforeEach(() => {
    mockPrisma = {
      member: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };
    useCase = new GetPublicTrainerProfileUseCase(mockPrisma as unknown as PrismaClient);
  });

  describe('Successful Retrieval & Slug Resolution', () => {
    it('should return sanitized full profile when looking up by slug', async () => {
      const mockMember = createMockMember();
      mockPrisma.member.findUnique.mockResolvedValue(null);
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);

      const profile = await useCase.execute('hassan-mahmoud');

      expect(profile).toBeDefined();
      expect(profile.id).toBe(mockMember.id);
      expect(profile.slug).toBe('hassan-mahmoud');
      expect(profile.firstName).toBe('Hassan');
      expect(profile.lastName).toBe('Mahmoud');
      expect(profile.bioEn).toBe(mockMember.bioEn);
      expect(profile.country).toBe('Egypt');
      expect(profile.city).toBe('Cairo');
      expect(profile.yearsOfExperience).toBe('6-10');
      expect(profile.linkedinUrl).toBe('https://linkedin.com/in/hassanmahmoud');
      expect(profile.photoUrl).toBe('/api/v1/files/photo-uuid-1/download');
      expect(profile.tier).toBe(MembershipTier.PROFESSIONAL);
      expect(profile.badgeType).toBe('FEATURED');
    });

    it('should return sanitized full profile when looking up by UUID identifier', async () => {
      const mockMember = createMockMember();
      mockPrisma.member.findUnique.mockResolvedValue(mockMember);

      const profile = await useCase.execute(mockMember.id);

      expect(profile).toBeDefined();
      expect(profile.id).toBe(mockMember.id);
      expect(profile.firstName).toBe('Hassan');
    });

    it('should resolve slug with hyphenated ID suffix gracefully', async () => {
      const mockMember = createMockMember();
      mockPrisma.member.findUnique.mockResolvedValue(null);
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);

      const profile = await useCase.execute('hassan-mahmoud-d3b07384');

      expect(profile).toBeDefined();
      expect(profile.id).toBe(mockMember.id);
    });

    it('should fallback gracefully to ID if name contains non-Latin characters and slug falls back to ID', async () => {
      const arabicOnlyMember = createMockMember({
        fullNameEn: '',
        fullNameAr: 'طارق عبد الله',
      });
      mockPrisma.member.findUnique.mockResolvedValue(arabicOnlyMember);

      const profile = await useCase.execute(arabicOnlyMember.id);

      expect(profile.slug).toBe(arabicOnlyMember.id);
      expect(profile.firstName).toBe('طارق');
      expect(profile.lastName).toBe('عبد الله');
    });
  });

  describe('Strict Privacy Isolation (PRO-38, DIR-18)', () => {
    it('should never expose email, phone, cvUrl, userId, or internal files in the DTO', async () => {
      const mockMember = createMockMember();
      mockPrisma.member.findUnique.mockResolvedValue(mockMember);

      const profile = (await useCase.execute(mockMember.id)) as unknown as Record<string, unknown>;

      expect(profile.email).toBeUndefined();
      expect(profile.phone).toBeUndefined();
      expect(profile.phoneNormalized).toBeUndefined();
      expect(profile.cvUrl).toBeUndefined();
      expect(profile.userId).toBeUndefined();
      expect(profile.files).toBeUndefined();
      expect(profile.user).toBeUndefined();
    });
  });

  describe('Eligibility Gating & 404 Not Found Defense (PRO-34)', () => {
    it('should throw NotFoundError if member does not exist', async () => {
      mockPrisma.member.findUnique.mockResolvedValue(null);
      mockPrisma.member.findFirst.mockResolvedValue(null);
      mockPrisma.member.findMany.mockResolvedValue([]);

      await expect(useCase.execute('non-existent-trainer')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if member has directoryOptIn: false', async () => {
      const optedOut = createMockMember({ directoryOptIn: false });
      mockPrisma.member.findUnique.mockResolvedValue(optedOut);

      await expect(useCase.execute(optedOut.id)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if member profile completion is under 100%', async () => {
      const incomplete = createMockMember({
        bioEn: null,
        bioAr: null,
        profileCompletionRate: 80,
      });
      mockPrisma.member.findUnique.mockResolvedValue(incomplete);

      await expect(useCase.execute(incomplete.id)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if membership status is SUSPENDED or CANCELLED', async () => {
      const suspended = createMockMember({
        memberships: [{ tier: MembershipTier.MASTER, status: MembershipStatus.SUSPENDED }],
      });
      mockPrisma.member.findUnique.mockResolvedValue(suspended);

      await expect(useCase.execute(suspended.id)).rejects.toThrow(NotFoundError);

      const cancelled = createMockMember({
        memberships: [{ tier: MembershipTier.MASTER, status: MembershipStatus.CANCELLED }],
      });
      mockPrisma.member.findUnique.mockResolvedValue(cancelled);

      await expect(useCase.execute(cancelled.id)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if user account status is not ACTIVE', async () => {
      const inactiveUser = createMockMember({
        user: { status: UserStatus.SUSPENDED },
      });
      mockPrisma.member.findUnique.mockResolvedValue(inactiveUser);

      await expect(useCase.execute(inactiveUser.id)).rejects.toThrow(NotFoundError);
    });
  });
});
