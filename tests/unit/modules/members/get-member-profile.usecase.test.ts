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
});
