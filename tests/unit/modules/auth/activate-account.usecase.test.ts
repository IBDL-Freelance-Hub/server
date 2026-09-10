import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { ActivateAccountUseCase } from '../../../../src/modules/auth/application/activate-account.usecase';
import { IHashProvider } from '../../../../src/shared/providers';
import { SessionService } from '../../../../src/modules/auth/infrastructure/session.service';
import { InvalidActivationTokenError, ValidationError } from '../../../../src/shared/errors';

describe('ActivateAccountUseCase Unit Tests (End-to-End Rebuild)', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockHashProvider: jest.Mocked<IHashProvider>;
  let mockSessionService: jest.Mocked<SessionService>;
  let useCase: ActivateAccountUseCase;

  const validRawToken = 'valid-raw-activation-token-12345';
  const validTokenHash = crypto.createHash('sha256').update(validRawToken).digest('hex');

  beforeEach(() => {
    mockPrisma = {
      verificationToken: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      securityConfig: {
        findFirst: jest.fn().mockResolvedValue({ passwordMinLength: 8 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      user: {
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    } as unknown as jest.Mocked<PrismaClient>;

    mockHashProvider = {
      hash: jest.fn().mockResolvedValue('$argon2id$hashedpassword'),
      verify: jest.fn(),
    };

    mockSessionService = {
      createSession: jest.fn().mockResolvedValue({
        rawToken: 'mock-session-raw-token',
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      }),
    } as unknown as jest.Mocked<SessionService>;

    useCase = new ActivateAccountUseCase(mockPrisma, mockHashProvider, mockSessionService);
  });

  // Scenario 1 & Scenario 8: Valid, unexpired, unused token → succeeds, password hashed correctly, status transitions to ACTIVE, session created, exactly one audit entry with action "ACCOUNT_ACTIVATED"
  it('Scenario 1 & 8: Valid, unexpired, unused token → succeeds, password hashed correctly, status transitions to ACTIVE, session created, audit entry written', async () => {
    const mockTokenRecord = {
      id: 'token-id-1',
      userId: 'user-id-1',
      purpose: 'ACTIVATION',
      tokenHash: validTokenHash,
      expiresAt: new Date(Date.now() + 86400000), // Future expiry
      usedAt: null,
      invalidatedAt: null,
      user: {
        id: 'user-id-1',
        email: 'member@example.com',
        status: 'UNACTIVATED',
      },
    };

    (mockPrisma.verificationToken.findUnique as jest.Mock).mockResolvedValue(mockTokenRecord);

    const result = await useCase.execute(
      {
        token: validRawToken,
        password: 'ValidPassword1',
        confirmPassword: 'ValidPassword1',
      },
      { ipAddress: '192.168.1.1', userAgent: 'jest-browser' },
    );

    expect(result.sessionToken).toBe('mock-session-raw-token');
    expect(result.user.status).toBe('ACTIVE');
    expect(mockHashProvider.hash).toHaveBeenCalledWith('ValidPassword1');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id-1' },
      data: { passwordHash: '$argon2id$hashedpassword', status: 'ACTIVE' },
    });
    expect(mockPrisma.verificationToken.update).toHaveBeenCalledWith({
      where: { id: 'token-id-1' },
      data: { usedAt: expect.any(Date) },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'user-id-1',
        action: 'ACCOUNT_ACTIVATED',
        resource: 'User',
        resourceId: 'user-id-1',
        ipAddress: '192.168.1.1',
      },
    });
    expect(mockSessionService.createSession).toHaveBeenCalledWith(
      'user-id-1',
      '192.168.1.1',
      'jest-browser',
    );
  });

  // Scenario 2: Expired token → recovery state, account stays UNACTIVATED, no password set, audit entry written, no notification
  it('Scenario 2: Expired token → throws InvalidActivationTokenError recovery state, audited as invalid_or_expired_token', async () => {
    const expiredTokenRecord = {
      id: 'token-id-expired',
      userId: 'user-id-1',
      purpose: 'ACTIVATION',
      tokenHash: validTokenHash,
      expiresAt: new Date(Date.now() - 3600000), // Past expiry
      usedAt: null,
      invalidatedAt: null,
      user: {
        id: 'user-id-1',
        email: 'member@example.com',
        status: 'UNACTIVATED',
      },
    };

    (mockPrisma.verificationToken.findUnique as jest.Mock).mockResolvedValue(expiredTokenRecord);

    await expect(
      useCase.execute({
        token: validRawToken,
        password: 'ValidPassword1',
        confirmPassword: 'ValidPassword1',
      }),
    ).rejects.toThrow(InvalidActivationTokenError);

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockHashProvider.hash).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'ACTIVATION_FAILED',
        resource: 'VerificationToken',
        reason: 'invalid_or_expired_token',
        ipAddress: null,
      },
    });
  });

  // Scenario 3: Already-used token → identical recovery-state response, audited
  it('Scenario 3: Already-used token → throws InvalidActivationTokenError, audited', async () => {
    const usedTokenRecord = {
      id: 'token-id-used',
      userId: 'user-id-1',
      purpose: 'ACTIVATION',
      tokenHash: validTokenHash,
      expiresAt: new Date(Date.now() + 86400000),
      usedAt: new Date(Date.now() - 3600000), // Already used
      invalidatedAt: null,
      user: {
        id: 'user-id-1',
        email: 'member@example.com',
        status: 'UNACTIVATED',
      },
    };

    (mockPrisma.verificationToken.findUnique as jest.Mock).mockResolvedValue(usedTokenRecord);

    await expect(
      useCase.execute({
        token: validRawToken,
        password: 'ValidPassword1',
        confirmPassword: 'ValidPassword1',
      }),
    ).rejects.toThrow(InvalidActivationTokenError);

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'ACTIVATION_FAILED',
        resource: 'VerificationToken',
        reason: 'invalid_or_expired_token',
        ipAddress: null,
      },
    });
  });

  // Scenario 4: Unrecognised/malformed token → identical recovery-state response
  it('Scenario 4: Unrecognised/malformed token → throws InvalidActivationTokenError, audited', async () => {
    (mockPrisma.verificationToken.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      useCase.execute({
        token: 'completely-unknown-token-string',
        password: 'ValidPassword1',
        confirmPassword: 'ValidPassword1',
      }),
    ).rejects.toThrow(InvalidActivationTokenError);

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'ACTIVATION_FAILED',
        resource: 'VerificationToken',
        reason: 'invalid_or_expired_token',
        ipAddress: null,
      },
    });
  });

  // Scenario 5: Valid token but account already ACTIVE → refused, audited with distinct "activation_replay_on_active_account" reason
  it('Scenario 5: Valid token but account already ACTIVE → refused with recovery state and audited with activation_replay_on_active_account', async () => {
    const activeUserTokenRecord = {
      id: 'token-id-active',
      userId: 'user-id-active',
      purpose: 'ACTIVATION',
      tokenHash: validTokenHash,
      expiresAt: new Date(Date.now() + 86400000),
      usedAt: null,
      invalidatedAt: null,
      user: {
        id: 'user-id-active',
        email: 'active@example.com',
        status: 'ACTIVE', // Already active!
      },
    };

    (mockPrisma.verificationToken.findUnique as jest.Mock).mockResolvedValue(activeUserTokenRecord);

    await expect(
      useCase.execute(
        {
          token: validRawToken,
          password: 'ValidPassword1',
          confirmPassword: 'ValidPassword1',
        },
        { ipAddress: '10.0.0.1' },
      ),
    ).rejects.toThrow(InvalidActivationTokenError);

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'user-id-active',
        action: 'ACTIVATION_FAILED',
        resource: 'User',
        resourceId: 'user-id-active',
        reason: 'activation_replay_on_active_account',
        ipAddress: '10.0.0.1',
      },
    });
  });

  // Scenario 6: Password fails policy → normal validation rejection, NO audit entry written
  it('Scenario 6: Password fails policy → normal ValidationError rejection, NO audit entry written', async () => {
    const mockTokenRecord = {
      id: 'token-id-1',
      userId: 'user-id-1',
      purpose: 'ACTIVATION',
      tokenHash: validTokenHash,
      expiresAt: new Date(Date.now() + 86400000),
      usedAt: null,
      invalidatedAt: null,
      user: {
        id: 'user-id-1',
        email: 'member@example.com',
        status: 'UNACTIVATED',
      },
    };

    (mockPrisma.verificationToken.findUnique as jest.Mock).mockResolvedValue(mockTokenRecord);

    // Password fails policy (no uppercase / short)
    await expect(
      useCase.execute({
        token: validRawToken,
        password: 'weak',
        confirmPassword: 'weak',
      }),
    ).rejects.toThrow(ValidationError);

    // CRITICAL REQUIREMENT: NO audit entry written for password policy failure!
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('Scenario 6b: Password matches account local part → fails policy FIRST before confirmation check, NO audit', async () => {
    const mockTokenRecord = {
      id: 'token-id-1',
      userId: 'user-id-1',
      purpose: 'ACTIVATION',
      tokenHash: validTokenHash,
      expiresAt: new Date(Date.now() + 86400000),
      usedAt: null,
      invalidatedAt: null,
      user: {
        id: 'user-id-1',
        email: 'john.doe@example.com',
        status: 'UNACTIVATED',
      },
    };

    (mockPrisma.verificationToken.findUnique as jest.Mock).mockResolvedValue(mockTokenRecord);

    await expect(
      useCase.execute({
        token: validRawToken,
        password: 'john.doe', // Equals local part of email
        confirmPassword: 'mismatch-confirm', // Even if mismatch, policy fails FIRST
      }),
    ).rejects.toThrow('Enter a password of at least 8 characters');

    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });
});
