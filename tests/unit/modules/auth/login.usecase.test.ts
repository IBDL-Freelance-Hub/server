import { PrismaClient } from '@prisma/client';
import { LoginUseCase } from '../../../../src/modules/auth/application/login.usecase';
import { IHashProvider } from '../../../../src/shared/providers';
import { SessionService } from '../../../../src/modules/auth/infrastructure/session.service';
import { AuthorizationError } from '../../../../src/shared/errors';

describe('LoginUseCase Unit Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockHashProvider: jest.Mocked<IHashProvider>;
  let mockSessionService: jest.Mocked<SessionService>;
  let useCase: LoginUseCase;

  beforeEach(() => {
    mockPrisma = {
      loginAttempt: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;

    mockHashProvider = {
      hash: jest.fn(),
      verify: jest.fn(),
    };

    mockSessionService = {
      createSession: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    useCase = new LoginUseCase(mockPrisma, mockHashProvider, mockSessionService);
  });

  it('should authenticate user with valid credentials and return session token', async () => {
    (mockPrisma.loginAttempt.findMany as jest.Mock).mockResolvedValue([]);
    const mockUser = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: '$argon2id$validhash',
      userType: 'MEMBER',
      status: 'ACTIVE',
    };
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockHashProvider.verify as jest.Mock).mockResolvedValue(true);
    (mockSessionService.createSession as jest.Mock).mockResolvedValue({
      rawToken: 'valid-session-token',
      expiresAt: new Date(),
    });
    (mockPrisma.loginAttempt.create as jest.Mock).mockResolvedValue({});

    const result = await useCase.execute({
      email: 'user@example.com',
      password: 'Password123',
    });

    expect(result.sessionToken).toBe('valid-session-token');
    expect(result.user.id).toBe('user-1');
    expect(mockPrisma.loginAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          successful: true,
        }),
      }),
    );
  });

  it('should record failed attempt and throw generic AuthenticationError for invalid password', async () => {
    (mockPrisma.loginAttempt.findMany as jest.Mock).mockResolvedValue([]);
    const mockUser = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: '$argon2id$validhash',
      status: 'ACTIVE',
    };
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockHashProvider.verify as jest.Mock).mockResolvedValue(false);

    await expect(
      useCase.execute({
        email: 'user@example.com',
        password: 'WrongPassword123',
      }),
    ).rejects.toThrow('That email address and password do not match an account.');

    expect(mockPrisma.loginAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'user@example.com',
          emailNormalized: 'user@example.com',
          successful: false,
        }),
      }),
    );
  });

  it('should throw AuthenticationError if account is locked due to 5 recent failed attempts', async () => {
    const now = Date.now();
    const fiveFailedAttempts = [
      { attemptedAt: new Date(now - 10 * 60 * 1000) },
      { attemptedAt: new Date(now - 8 * 60 * 1000) },
      { attemptedAt: new Date(now - 6 * 60 * 1000) },
      { attemptedAt: new Date(now - 4 * 60 * 1000) },
      { attemptedAt: new Date(now - 2 * 60 * 1000) },
    ];
    (mockPrisma.loginAttempt.findMany as jest.Mock).mockResolvedValue(fiveFailedAttempts);

    await expect(
      useCase.execute({
        email: 'locked@example.com',
        password: 'Password123',
      }),
    ).rejects.toThrow('Account locked. Try again in 30 minutes.');
  });

  it('should throw AuthorizationError if account status is SUSPENDED', async () => {
    (mockPrisma.loginAttempt.findMany as jest.Mock).mockResolvedValue([]);
    const mockSuspendedUser = {
      id: 'user-1',
      email: 'suspended@example.com',
      passwordHash: '$argon2id$validhash',
      userType: 'MEMBER',
      status: 'SUSPENDED',
    };
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockSuspendedUser);
    (mockHashProvider.verify as jest.Mock).mockResolvedValue(true);

    await expect(
      useCase.execute({
        email: 'suspended@example.com',
        password: 'Password123',
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});
