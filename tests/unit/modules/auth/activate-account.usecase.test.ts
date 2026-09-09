import { PrismaClient } from '@prisma/client';
import { ActivateAccountUseCase } from '../../../../src/modules/auth/application/activate-account.usecase';
import { IHashProvider } from '../../../../src/shared/providers';
import { SessionService } from '../../../../src/modules/auth/infrastructure/session.service';
import { NotFoundError } from '../../../../src/shared/errors';

describe('ActivateAccountUseCase Unit Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockHashProvider: jest.Mocked<IHashProvider>;
  let mockSessionService: jest.Mocked<SessionService>;
  let useCase: ActivateAccountUseCase;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as jest.Mocked<PrismaClient>;

    mockHashProvider = {
      hash: jest.fn(),
      verify: jest.fn(),
    };

    mockSessionService = {
      createSession: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    useCase = new ActivateAccountUseCase(mockPrisma, mockHashProvider, mockSessionService);
  });

  it('should activate account successfully and return session token', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'user@example.com',
      emailNormalized: 'user@example.com',
      status: 'PENDING',
    };

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockHashProvider.hash as jest.Mock).mockResolvedValue('$argon2id$hashedpassword');
    (mockSessionService.createSession as jest.Mock).mockResolvedValue({
      rawToken: 'mock-raw-session-token',
      expiresAt: new Date(),
    });

    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const tx = {
        user: { update: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      return callback(tx);
    });

    const result = await useCase.execute(
      {
        email: 'user@example.com',
        password: 'SecurePassword123',
        confirmPassword: 'SecurePassword123',
      },
      { ipAddress: '127.0.0.1', userAgent: 'jest' },
    );

    expect(result.sessionToken).toBe('mock-raw-session-token');
    expect(result.user.status).toBe('ACTIVE');
    expect(mockHashProvider.hash).toHaveBeenCalledWith('SecurePassword123');
    expect(mockSessionService.createSession).toHaveBeenCalledWith('user-1', '127.0.0.1', 'jest');
  });

  it('should throw NotFoundError if user email is not registered', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      useCase.execute({
        email: 'unregistered@example.com',
        password: 'SecurePassword123',
        confirmPassword: 'SecurePassword123',
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
