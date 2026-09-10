import { PrismaClient } from '@prisma/client';
import { ResendActivationLinkUseCase } from '../../../../src/modules/auth/application/resend-activation-link.usecase';
import { TokenRateLimiterService } from '../../../../src/modules/auth/infrastructure/token-rate-limiter.service';

describe('ResendActivationLinkUseCase & TokenRateLimiter Unit Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockRateLimiter: jest.Mocked<TokenRateLimiterService>;
  let useCase: ResendActivationLinkUseCase;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      securityConfig: {
        findFirst: jest.fn().mockResolvedValue({ activationLinkLifetimeMinutes: 10 }),
      },
      verificationToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    } as unknown as jest.Mocked<PrismaClient>;

    mockRateLimiter = {
      checkAndLogRequest: jest.fn().mockResolvedValue({ allowed: true }),
    } as unknown as jest.Mocked<TokenRateLimiterService>;

    const mockEmailSvc = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new ResendActivationLinkUseCase(mockPrisma, mockRateLimiter, mockEmailSvc);
  });

  // Scenario 7: Resend flow → old token invalidated, new token issued, audit written
  it('Scenario 7: Resend flow → old token invalidated, fresh token created, audited with ACTIVATION_LINK_RESENT', async () => {
    const mockUser = {
      id: 'user-unactivated-1',
      email: 'user@example.com',
      emailNormalized: 'user@example.com',
      status: 'UNACTIVATED',
    };

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const result = await useCase.execute(
      { email: 'user@example.com' },
      { ipAddress: '192.168.1.50' },
    );

    expect(result.success).toBe(true);
    expect(mockRateLimiter.checkAndLogRequest).toHaveBeenCalledWith({
      purpose: 'ACTIVATION',
      email: 'user@example.com',
      ipAddress: '192.168.1.50',
    });
    expect(mockPrisma.verificationToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-unactivated-1',
        purpose: 'ACTIVATION',
        usedAt: null,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: expect.any(Date),
      },
    });
    expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-unactivated-1',
        purpose: 'ACTIVATION',
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      },
    });

    const createCallData = (mockPrisma.verificationToken.create as jest.Mock).mock.calls[0][0].data;
    const expiresAtMs = createCallData.expiresAt.getTime();
    const expectedDiffMs = 10 * 60 * 1000; // 10 minutes
    const actualDiffMs = expiresAtMs - Date.now();
    expect(actualDiffMs).toBeGreaterThan(expectedDiffMs - 5000);
    expect(actualDiffMs).toBeLessThanOrEqual(expectedDiffMs + 5000);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'user-unactivated-1',
        action: 'ACTIVATION_LINK_RESENT',
        resource: 'User',
        resourceId: 'user-unactivated-1',
        ipAddress: '192.168.1.50',
      },
    });
  });

  it('Resend flow when rate limit exceeded → returns generic success response without issuing new token', async () => {
    (mockRateLimiter.checkAndLogRequest as jest.Mock).mockResolvedValue({ allowed: false });

    const result = await useCase.execute(
      { email: 'spammer@example.com' },
      { ipAddress: '10.0.0.99' },
    );

    expect(result.success).toBe(true);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.verificationToken.create).not.toHaveBeenCalled();
  });
});
