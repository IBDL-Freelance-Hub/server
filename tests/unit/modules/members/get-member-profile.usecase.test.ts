import { PrismaClient } from '@prisma/client';
import { GetMemberProfileUseCase } from '../../../../src/modules/members/application/get-member-profile.usecase';
import { NotFoundError } from '../../../../src/shared/errors';

describe('GetMemberProfileUseCase Unit Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let useCase: GetMemberProfileUseCase;

  const mockDbMember = {
    id: 'member-uuid-1',
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
    bioEn: 'Experienced software architect.',
    bioAr: 'مهندس معماري برمجيات خبير.',
    linkedinUrl: 'https://linkedin.com/in/hassanmahmoud',
    photoFileId: 'photo-uuid-1',
    directoryOptIn: true,
    profileCompletionRate: 100,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    user: {
      id: 'user-uuid-1',
      email: 'hassan@example.com',
      userType: 'MEMBER',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01'),
    },
    memberships: [
      {
        id: 'membership-uuid-1',
        tier: 'ESSENTIAL',
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
      },
    ],
    files: [
      {
        id: 'file-cv-1',
        category: 'CV',
        originalName: 'hassan-cv.pdf',
        sizeBytes: 1048576,
        mimeType: 'application/pdf',
        createdAt: new Date('2026-01-01'),
      },
    ],
  };

  beforeEach(() => {
    mockPrisma = {
      member: {
        findUnique: jest.fn(),
      },
      assessmentCredentialPool: {
        findFirst: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;

    useCase = new GetMemberProfileUseCase(mockPrisma);
  });

  it('should successfully retrieve member profile and calculate 100% completion when all fields populated', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockDbMember);

    const result = await useCase.execute('user-uuid-1');

    expect(mockPrisma.member.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-uuid-1' },
      include: expect.any(Object),
    });

    expect(result.id).toBe('member-uuid-1');
    expect(result.userId).toBe('user-uuid-1');
    expect(result.email).toBe('hassan@example.com');
    expect(result.fullNameEn).toBe('Hassan Mahmoud');
    expect(result.fullNameAr).toBe('حسن محمود');
    expect(result.city).toBe('Cairo');
    expect(result.completionPercentage).toBe(100);
    expect(result.profileCompletionRate).toBe(100);
    expect(result.missingFields).toHaveLength(0);
    expect(result.membership).toEqual({
      id: 'membership-uuid-1',
      tier: 'ESSENTIAL',
      status: 'ACTIVE',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-01-01'),
    });
    expect(result.files).toHaveLength(1);
  });

  it('should calculate partial completion and return missing fields accurately (VAL-58)', async () => {
    const partialMember = {
      ...mockDbMember,
      city: null,
      bioEn: null,
      bioAr: null,
      files: [], // No CV
    };

    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(partialMember);

    const result = await useCase.execute('user-uuid-1');

    // 8 out of 11 fields -> Math.round((8/11)*100) = 73%
    expect(result.completionPercentage).toBe(73);
    expect(result.missingFields).toEqual(['city', 'bio', 'cv']);
  });

  it('should throw NotFoundError if member profile does not exist', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(useCase.execute('non-existent-user')).rejects.toThrow(NotFoundError);
    await expect(useCase.execute('non-existent-user')).rejects.toThrow('Member profile not found');
  });

  it('should return unified credentials with all 3 assessment portals when user is ACTIVE', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockDbMember);
    (mockPrisma.assessmentCredentialPool.findFirst as jest.Mock).mockResolvedValue({
      id: 'cred-1',
      username: 'flh.testuser',
      password: 'LivePassword123!',
      accessUrl: 'https://pqp.ibdl.net/start',
    });

    const result = await useCase.execute('user-uuid-1');

    expect(result.assessmentCredentials).toBeDefined();
    expect(result.assessmentCredentials?.status).toBe('ACTIVE');
    expect(result.assessmentCredentials?.username).toBe('flh.testuser');
    expect(result.assessmentCredentials?.password).toBe('LivePassword123!');
    expect(result.assessmentCredentials?.portals).toHaveLength(3);
    expect(result.assessmentCredentials?.portals?.[0]?.key).toBe('pqp');
    expect(result.assessmentCredentials?.portals?.[1]?.key).toBe('cpat');
    expect(result.assessmentCredentials?.portals?.[2]?.key).toBe('md');
  });

  it('should return LOCKED assessment status without exposing credentials when user is not ACTIVE', async () => {
    const inactiveMember = {
      ...mockDbMember,
      user: {
        ...mockDbMember.user,
        status: 'UNACTIVATED',
      },
    };
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(inactiveMember);

    const result = await useCase.execute('user-uuid-1');

    expect(result.assessmentCredentials).toBeDefined();
    expect(result.assessmentCredentials?.status).toBe('LOCKED');
    expect(result.assessmentCredentials?.username).toBeUndefined();
    expect(result.assessmentCredentials?.password).toBeUndefined();
  });
});
