import { PrismaClient } from '@prisma/client';
import { UpdateMemberProfileUseCase } from '../../../../src/modules/members/application/update-member-profile.usecase';
import { ConflictError, NotFoundError, ValidationError } from '../../../../src/shared/errors';

describe('UpdateMemberProfileUseCase Unit Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let useCase: UpdateMemberProfileUseCase;

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
    industriesServed: ['FinTech'],
    languages: ['Arabic', 'English'],
    bioEn: 'Experienced software architect.',
    bioAr: 'مهندس برمجيات.',
    linkedinUrl: 'https://linkedin.com/in/hassanmahmoud',
    photoFileId: 'photo-uuid-1',
    directoryOptIn: false,
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
    const mockTx = {
      member: {
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    mockPrisma = {
      member: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      securityConfig: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
    } as unknown as jest.Mocked<PrismaClient>;

    // Expose mockTx on mockPrisma for assertions
    (mockPrisma as unknown as { _mockTx: typeof mockTx })._mockTx = mockTx;

    useCase = new UpdateMemberProfileUseCase(mockPrisma);
  });

  it('should successfully update profile fields, recalculate completion, and write AuditLog inside transaction', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockDbMember);

    const mockTx = (
      mockPrisma as unknown as {
        _mockTx: { member: { update: jest.Mock }; auditLog: { create: jest.Mock } };
      }
    )._mockTx;
    const updatedDbRecord = {
      ...mockDbMember,
      city: 'Alexandria',
      directoryOptIn: true,
      bioEn: 'Updated bio in English.',
      profileCompletionRate: 100,
    };
    mockTx.member.update.mockResolvedValue(updatedDbRecord);
    mockTx.auditLog.create.mockResolvedValue({ id: 'audit-log-1' });

    const result = await useCase.execute(
      'user-uuid-1',
      {
        city: 'Alexandria',
        directoryOptIn: true,
        bioEn: 'Updated bio in English.',
      },
      { ipAddress: '127.0.0.1', requestId: 'req-123' },
    );

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    expect(mockTx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'member-uuid-1' },
        data: expect.objectContaining({
          city: 'Alexandria',
          directoryOptIn: true,
          bioEn: 'Updated bio in English.',
          profileCompletionRate: 100,
        }),
      }),
    );

    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'user-uuid-1',
        actorRole: 'MEMBER',
        action: 'PROFILE_UPDATED',
        resource: 'Member',
        resourceId: 'member-uuid-1',
        ipAddress: '127.0.0.1',
        requestId: 'req-123',
        previousState: expect.objectContaining({
          city: 'Cairo',
          directoryOptIn: false,
        }),
        newState: expect.objectContaining({
          city: 'Alexandria',
          directoryOptIn: true,
        }),
      }),
    });

    expect(result.profile.city).toBe('Alexandria');
    expect(result.profile.directoryOptIn).toBe(true);
    expect(result.completionPercentage).toBe(100);
    expect(result.missingFields).toHaveLength(0);
  });

  it('should recalculate profile completion based on merged post-update state (VAL-58)', async () => {
    // Start with complete profile, update bioEn and bioAr to null (clearing them)
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockDbMember);

    const mockTx = (
      mockPrisma as unknown as {
        _mockTx: { member: { update: jest.Mock }; auditLog: { create: jest.Mock } };
      }
    )._mockTx;
    const updatedDbRecord = {
      ...mockDbMember,
      bioEn: null,
      bioAr: null,
      profileCompletionRate: 91, // 10 out of 11 fields
    };
    mockTx.member.update.mockResolvedValue(updatedDbRecord);
    mockTx.auditLog.create.mockResolvedValue({ id: 'audit-log-2' });

    const result = await useCase.execute('user-uuid-1', {
      bioEn: null,
      bioAr: null,
    });

    expect(mockTx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profileCompletionRate: 91,
        }),
      }),
    );
    expect(result.completionPercentage).toBe(91);
    expect(result.missingFields).toEqual(['bio']);
  });

  it('should strictly reject email modification attempts (PRO-04, VAL-50)', async () => {
    await expect(
      useCase.execute('user-uuid-1', {
        email: 'newemail@example.com',
      } as unknown as { email: string }),
    ).rejects.toThrow(ValidationError);

    await expect(
      useCase.execute('user-uuid-1', {
        email: 'newemail@example.com',
      } as unknown as { email: string }),
    ).rejects.toThrow('Email address is read-only and cannot be modified (PRO-04, VAL-50)');
  });

  it('should reject clearing mandatory fields with empty/whitespace/null strings (VAL-57)', async () => {
    await expect(useCase.execute('user-uuid-1', { city: '' })).rejects.toThrow(ValidationError);
    await expect(useCase.execute('user-uuid-1', { city: '   ' })).rejects.toThrow(
      'City cannot be empty or null (VAL-57)',
    );

    await expect(useCase.execute('user-uuid-1', { fullNameEn: '' })).rejects.toThrow(
      ValidationError,
    );
    await expect(useCase.execute('user-uuid-1', { fullNameEn: '   ' })).rejects.toThrow(
      'Full name in English cannot be empty or null (VAL-57)',
    );

    await expect(useCase.execute('user-uuid-1', { phone: '' })).rejects.toThrow(ValidationError);
    await expect(useCase.execute('user-uuid-1', { phone: '   ' })).rejects.toThrow(
      'Phone cannot be empty or null (VAL-57)',
    );

    await expect(
      useCase.execute('user-uuid-1', { yearsOfExperience: '' as unknown as '<2' }),
    ).rejects.toThrow(ValidationError);
  });

  it('should normalize phone and check uniqueness on phone update', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockDbMember);
    (mockPrisma.member.findFirst as jest.Mock).mockResolvedValue(null);

    const mockTx = (
      mockPrisma as unknown as {
        _mockTx: { member: { update: jest.Mock }; auditLog: { create: jest.Mock } };
      }
    )._mockTx;
    mockTx.member.update.mockResolvedValue({
      ...mockDbMember,
      phone: '01099998888',
      phoneNormalized: '+201099998888',
    });
    mockTx.auditLog.create.mockResolvedValue({ id: 'audit-log-3' });

    await useCase.execute('user-uuid-1', {
      phone: '01099998888',
      country: 'Egypt',
    });

    expect(mockPrisma.member.findFirst).toHaveBeenCalledWith({
      where: {
        phoneNormalized: '+201099998888',
        id: { not: 'member-uuid-1' },
      },
    });

    expect(mockTx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: '01099998888',
          phoneNormalized: '+201099998888',
        }),
      }),
    );
  });

  it('should throw ConflictError if updated phone belongs to another member', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockDbMember);
    (mockPrisma.member.findFirst as jest.Mock).mockResolvedValue({
      id: 'other-member-id',
      phoneNormalized: '+201099998888',
    });

    await expect(
      useCase.execute('user-uuid-1', {
        phone: '01099998888',
        country: 'Egypt',
      }),
    ).rejects.toThrow(ConflictError);

    await expect(
      useCase.execute('user-uuid-1', {
        phone: '01099998888',
        country: 'Egypt',
      }),
    ).rejects.toThrow('This mobile number is already in use by another member');
  });

  it('should throw NotFoundError if member profile does not exist', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(useCase.execute('unknown-user', { city: 'Cairo' })).rejects.toThrow(NotFoundError);
  });

  it('should enforce VAL-08 default max bio length (5000 characters) when securityConfig has default', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockDbMember);
    (mockPrisma.securityConfig.findFirst as jest.Mock).mockResolvedValue({
      multiLineFieldMaxLength: 5000,
    });

    const longBio = 'a'.repeat(5001);

    await expect(
      useCase.execute('user-uuid-1', {
        bioEn: longBio,
      }),
    ).rejects.toThrow('This entry is too long. Shorten it to 5000 characters or fewer.');

    await expect(
      useCase.execute('user-uuid-1', {
        bioAr: longBio,
      }),
    ).rejects.toThrow('هذا الإدخال طويل جداً. يرجى تقصيره إلى 5000 حرفاً أو أقل.');
  });

  it('should enforce dynamically configured max bio length from SecurityConfig (VAL-08)', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockDbMember);
    (mockPrisma.securityConfig.findFirst as jest.Mock).mockResolvedValue({
      multiLineFieldMaxLength: 2000,
    });

    const bio2001 = 'a'.repeat(2001);

    await expect(
      useCase.execute('user-uuid-1', {
        bioEn: bio2001,
      }),
    ).rejects.toThrow('This entry is too long. Shorten it to 2000 characters or fewer.');
  });

  it('should gracefully fallback to 5000 characters when SecurityConfig is not yet seeded (VAL-08)', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockDbMember);
    (mockPrisma.securityConfig.findFirst as jest.Mock).mockResolvedValue(null);

    const bio5001 = 'a'.repeat(5001);

    await expect(
      useCase.execute('user-uuid-1', {
        bioEn: bio5001,
      }),
    ).rejects.toThrow('This entry is too long. Shorten it to 5000 characters or fewer.');
  });

  it('should gracefully fallback to 5000 characters when SecurityConfig query fails or is temporarily unavailable (VAL-08)', async () => {
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockDbMember);
    (mockPrisma.securityConfig.findFirst as jest.Mock).mockRejectedValue(
      new Error('Database temporarily unavailable'),
    );

    const bio5001 = 'a'.repeat(5001);

    await expect(
      useCase.execute('user-uuid-1', {
        bioEn: bio5001,
      }),
    ).rejects.toThrow('This entry is too long. Shorten it to 5000 characters or fewer.');
  });
});
