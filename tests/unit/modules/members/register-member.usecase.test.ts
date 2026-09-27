import { PrismaClient } from '@prisma/client';
import { RegisterMemberUseCase } from '../../../../src/modules/members/application/register-member.usecase';
import { RegisterMemberInput } from '../../../../src/modules/members/presentation/members.schema';
import { ConflictError, ValidationError } from '../../../../src/shared/errors';
import { IEmailProvider } from '../../../../src/shared/providers';

describe('RegisterMemberUseCase Unit Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockEmailProvider: jest.Mocked<IEmailProvider>;
  let useCase: RegisterMemberUseCase;

  const validRegistrationInput: RegisterMemberInput = {
    fullName: 'Marwa Ashraf',
    email: 'marwa.ashraf@example.com',
    mobile: '01012345678',
    country: 'Egypt',
    yearsOfExperience: '2-5',
    areasOfExpertise: ['Software Development'],
    industriesServed: ['Healthcare'],
    termsAccepted: true,
    directoryOptIn: true,
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      member: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      membership: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      securityConfig: {
        findFirst: jest.fn().mockResolvedValue({ activationLinkLifetimeMinutes: 10 }),
      },
      $transaction: jest.fn(),
    } as unknown as jest.Mocked<PrismaClient>;

    mockEmailProvider = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new RegisterMemberUseCase(mockPrisma, mockEmailProvider);
  });

  it('should throw ValidationError if termsAccepted is false', async () => {
    const invalidInput = {
      ...validRegistrationInput,
      termsAccepted: false,
    } as unknown as RegisterMemberInput;

    await expect(useCase.execute(invalidInput)).rejects.toThrow(ValidationError);
  });

  it('should successfully register a member, record 3 policy acceptances, dispatch email and fallback when pool is empty', async () => {
    // No duplicate found
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    const mockUser = {
      id: 'user-uuid-1',
      email: 'marwa.ashraf@example.com',
      emailNormalized: 'marwa.ashraf@example.com',
      userType: 'MEMBER',
      status: 'ACTIVE',
    };

    const mockMember = {
      id: 'member-uuid-1',
      userId: 'user-uuid-1',
      fullNameEn: 'Marwa Ashraf',
      phone: '01012345678',
      phoneNormalized: '+201012345678',
      country: 'Egypt',
    };

    const auditLogCalls: Record<string, unknown>[] = [];
    // $transaction callback execution simulation
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const mockAuditCreate = jest.fn().mockImplementation((args) => {
        if (args?.data) {
          auditLogCalls.push(args.data as Record<string, unknown>);
        }
        return Promise.resolve(args.data || {});
      });

      const mockAuditCreateMany = jest.fn().mockImplementation((args) => {
        if (Array.isArray(args.data)) {
          args.data.forEach((item: unknown) => auditLogCalls.push(item as Record<string, unknown>));
        }
        return Promise.resolve({ count: args.data?.length || 0 });
      });

      const tx = {
        user: { create: jest.fn().mockResolvedValue(mockUser) },
        member: { create: jest.fn().mockResolvedValue(mockMember) },
        membership: { create: jest.fn().mockResolvedValue({}) },
        verificationToken: { create: jest.fn().mockResolvedValue({}) },
        auditLog: { create: mockAuditCreate, createMany: mockAuditCreateMany },
        assessmentCredentialPool: {
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      };
      return callback(tx);
    });

    const result = await useCase.execute(validRegistrationInput, {
      requestId: 'req-123',
      ipAddress: '127.0.0.1',
    });

    expect(result.member.id).toBe('member-uuid-1');
    expect(result.member.fullName).toBe('Marwa Ashraf');
    expect(result.member.email).toBe('marwa.ashraf@example.com');
    expect(result.membership.tier).toBe('Essential Membership');
    expect(result.membership.fee).toBe('Free');
    expect(result.pqpAccess.username).toBe('flh.marwa');
    expect(result.pqpAccess.password).toBe('ASSESSMENT-2026-DEMO');
    expect(result.pqpAccess.assessmentLink).toBe('https://assessment.ibdl.net/start');
    expect(result.welcomeEmail.from).toBe('freelancers.hub@ibdl.net');

    // Assert 3 policy acceptances recorded in audit log (SEC-13, SEC-14)
    const policyAcceptanceAudits = auditLogCalls.filter((a) => a.action === 'POLICY_ACCEPTED');
    expect(policyAcceptanceAudits).toHaveLength(3);

    const policyTypes = policyAcceptanceAudits.map(
      (a) => (a.newState as { policyType: string }).policyType,
    );
    expect(policyTypes).toEqual(['PRIVACY_POLICY', 'TERMS_OF_USE', 'COOKIE_POLICY']);

    // Assert welcome email dispatch with PQP credentials (NTF-31)
    expect(mockEmailProvider.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'marwa.ashraf@example.com',
        subject: expect.stringMatching(/Welcome to Freelancers Hub|PQP/),
      }),
    );
  });

  it('should claim pre-generated credential from pool when AVAILABLE credentials exist', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    const mockUser = {
      id: 'user-uuid-2',
      email: 'marwa.ashraf@example.com',
      emailNormalized: 'marwa.ashraf@example.com',
    };
    const mockMember = {
      id: 'member-uuid-2',
      userId: 'user-uuid-2',
      fullNameEn: 'Marwa Ashraf',
    };

    const mockPoolCredential = {
      id: 'pool-cred-99',
      username: 'pqp_real_user_88',
      password: 'RealSecretPassword99',
      accessUrl: 'pqp.ibdl.net/real-portal',
      status: 'AVAILABLE',
    };

    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const tx = {
        user: { create: jest.fn().mockResolvedValue(mockUser) },
        member: { create: jest.fn().mockResolvedValue(mockMember) },
        membership: { create: jest.fn().mockResolvedValue({}) },
        verificationToken: { create: jest.fn().mockResolvedValue({}) },
        auditLog: {
          create: jest.fn().mockResolvedValue({}),
          createMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
        assessmentCredentialPool: {
          findFirst: jest.fn().mockResolvedValue(mockPoolCredential),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      return callback(tx);
    });

    const result = await useCase.execute(validRegistrationInput);

    expect(result.pqpAccess.username).toBe('pqp_real_user_88');
    expect(result.pqpAccess.password).toBe('RealSecretPassword99');
    expect(result.pqpAccess.assessmentLink).toBe('pqp.ibdl.net/real-portal');
    expect(result.pqpAccess.note).toBe('Live pre-generated assessment voucher claimed from pool.');
  });

  it('should throw ConflictError with clashType "email" when email is already registered', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'existing-user-id',
    });
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(useCase.execute(validRegistrationInput)).rejects.toThrow(ConflictError);

    try {
      await useCase.execute(validRegistrationInput);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ConflictError);
      const conflictErr = err as ConflictError;
      expect(conflictErr.details).toEqual({ clashType: 'email' });
    }
  });

  it('should throw ConflictError with clashType "mobile" when mobile is already registered', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'existing-member-id',
    });

    try {
      await useCase.execute(validRegistrationInput);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ConflictError);
      const conflictErr = err as ConflictError;
      expect(conflictErr.details).toEqual({ clashType: 'mobile' });
    }
  });

  it('should throw ConflictError with clashType "both" when both email and mobile are registered', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'existing-user-id',
    });
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'existing-member-id',
    });

    try {
      await useCase.execute(validRegistrationInput);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ConflictError);
      const conflictErr = err as ConflictError;
      expect(conflictErr.details).toEqual({ clashType: 'both' });
    }
  });

  it('should reject registration with ValidationError when a renamed .jpg is submitted as cv.pdf (magic byte mismatch)', async () => {
    // A JPEG file disguised as "cv.pdf" (starts with 0xFF 0xD8 0xFF instead of %PDF-)
    const renamedJpgAsPdfBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);

    const fakeFileInput = {
      buffer: renamedJpgAsPdfBuffer,
      originalname: 'cv.pdf',
      size: renamedJpgAsPdfBuffer.length,
    };

    await expect(useCase.execute(validRegistrationInput, undefined, fakeFileInput)).rejects.toThrow(
      ValidationError,
    );

    // Verify error message specifies signature verification failure (UPL-02, UPL-14)
    try {
      await useCase.execute(validRegistrationInput, undefined, fakeFileInput);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ValidationError);
      const valErr = err as ValidationError;
      expect(valErr.message).toContain('verified by signature are accepted');
    }

    // Verify database transaction was never invoked
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should successfully validate CV and persist through UploadCvUseCase when valid PDF is provided', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    const mockUser = {
      id: 'user-cv-1',
      email: 'marwa.ashraf@example.com',
      emailNormalized: 'marwa.ashraf@example.com',
    };
    const mockMember = {
      id: 'member-cv-1',
      userId: 'user-cv-1',
      fullNameEn: 'Marwa Ashraf',
    };

    (mockPrisma.member.findUnique as jest.Mock).mockImplementation((args) => {
      if (args?.where?.userId === 'user-cv-1') {
        return Promise.resolve({
          ...mockMember,
          user: mockUser,
          files: [],
        });
      }
      return Promise.resolve(null);
    });

    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const tx = {
        user: { create: jest.fn().mockResolvedValue(mockUser) },
        member: {
          create: jest.fn().mockResolvedValue(mockMember),
          update: jest.fn().mockResolvedValue(mockMember),
        },
        membership: { create: jest.fn().mockResolvedValue({}) },
        verificationToken: { create: jest.fn().mockResolvedValue({}) },
        file: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn().mockResolvedValue({
            id: 'file-uuid-1',
            originalName: 'real_resume.pdf',
            status: 'ACTIVE',
          }),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({}),
          createMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
        assessmentCredentialPool: {
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      };
      return callback(tx);
    });

    const validPdfBuffer = Buffer.from(
      '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF',
    );
    const validFileInput = {
      buffer: validPdfBuffer,
      originalname: 'real_resume.pdf',
      size: validPdfBuffer.length,
    };

    const result = await useCase.execute(validRegistrationInput, undefined, validFileInput);
    expect(result.member.id).toBe('member-cv-1');
  });
});
