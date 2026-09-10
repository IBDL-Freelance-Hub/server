import { PrismaClient } from '@prisma/client';
import { ForgotPasswordUseCase } from '../../../../src/modules/auth/application/forgot-password.usecase';
import { TokenRateLimiterService } from '../../../../src/modules/auth/infrastructure/token-rate-limiter.service';
import { IEmailProvider } from '../../../../src/shared/providers';

describe('ForgotPasswordUseCase Unit Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockRateLimiter: jest.Mocked<TokenRateLimiterService>;
  let mockEmailProvider: jest.Mocked<IEmailProvider>;
  let useCase: ForgotPasswordUseCase;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      securityConfig: {
        findFirst: jest.fn(),
      },
      verificationToken: {
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    } as unknown as jest.Mocked<PrismaClient>;

    mockRateLimiter = {
      checkAndLogRequest: jest.fn(),
    } as unknown as jest.Mocked<TokenRateLimiterService>;

    mockEmailProvider = {
      sendEmail: jest.fn(),
    };

    useCase = new ForgotPasswordUseCase(mockPrisma, mockRateLimiter, mockEmailProvider);
  });

  it('should return generic success message when rate limit is exceeded', async () => {
    (mockRateLimiter.checkAndLogRequest as jest.Mock).mockResolvedValue({ allowed: false });

    const result = await useCase.execute({ email: 'user@example.com' });

    expect(result.success).toBe(true);
    expect(result.message).toBe(
      'If that email matches an account, a secure reset link has been sent.',
    );
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should return generic success message and skip token creation if user is not found or inactive', async () => {
    (mockRateLimiter.checkAndLogRequest as jest.Mock).mockResolvedValue({ allowed: true });
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await useCase.execute({ email: 'nonexistent@example.com' });

    expect(result.success).toBe(true);
    expect(result.message).toBe(
      'If that email matches an account, a secure reset link has been sent.',
    );
    expect(mockPrisma.verificationToken.create).not.toHaveBeenCalled();
    expect(mockEmailProvider.sendEmail).not.toHaveBeenCalled();
  });

  it('should issue token, record audit log, and send reset email for active user', async () => {
    (mockRateLimiter.checkAndLogRequest as jest.Mock).mockResolvedValue({ allowed: true });
    const mockUser = {
      id: 'active-user-1',
      email: 'active@example.com',
      status: 'ACTIVE',
    };
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockPrisma.securityConfig.findFirst as jest.Mock).mockResolvedValue({
      resetTokenLifetimeMinutes: 10,
    });

    const result = await useCase.execute({ email: 'active@example.com' });

    expect(result.success).toBe(true);
    expect(mockPrisma.verificationToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'active-user-1',
          purpose: 'PASSWORD_RESET',
        }),
      }),
    );
    expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'active-user-1',
          purpose: 'PASSWORD_RESET',
        }),
      }),
    );
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PASSWORD_RESET_REQUESTED',
          resourceId: 'active-user-1',
        }),
      }),
    );
    expect(mockEmailProvider.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'active@example.com',
        subject: 'Reset Your IBDL Freelancer Hub Password',
      }),
    );
  });
});
