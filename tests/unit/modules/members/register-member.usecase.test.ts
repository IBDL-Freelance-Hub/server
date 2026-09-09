import { PrismaClient } from '@prisma/client';
import { RegisterMemberUseCase } from '../../../../src/modules/members/application/register-member.usecase';
import { RegisterMemberInput } from '../../../../src/modules/members/presentation/members.schema';
import { ConflictError } from '../../../../src/shared/errors';

describe('RegisterMemberUseCase Unit Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
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
      },
      $transaction: jest.fn(),
    } as unknown as jest.Mocked<PrismaClient>;

    useCase = new RegisterMemberUseCase(mockPrisma);
  });

  it('should successfully register a member and return PQP specimen credentials & details', async () => {
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

    // $transaction callback execution simulation
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const tx = {
        user: { create: jest.fn().mockResolvedValue(mockUser) },
        member: { create: jest.fn().mockResolvedValue(mockMember) },
        membership: { create: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
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
    expect(result.pqpAccess.password).toBe('PQP-2026-DEMO');
    expect(result.pqpAccess.assessmentLink).toBe('pqp.ibdl.net/start');
    expect(result.welcomeEmail.from).toBe('freelancers.hub@ibdl.net');
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
});
