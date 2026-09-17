import { PrismaClient } from '@prisma/client';
import { ResetPasswordUseCase } from '../../../../src/modules/auth/application/reset-password.usecase';
import { IHashProvider } from '../../../../src/shared/providers';
import { SessionService } from '../../../../src/modules/auth/infrastructure/session.service';
import { PasswordHistoryService } from '../../../../src/modules/auth/infrastructure/password-history.service';
import { InvalidTokenError, ValidationError } from '../../../../src/shared/errors';
import { PASSWORD_HISTORY_REUSE_ERROR } from '../../../../src/modules/auth/domain';

describe('ResetPasswordUseCase Unit Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockHashProvider: jest.Mocked<IHashProvider>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockPasswordHistoryService: jest.Mocked<PasswordHistoryService>;
  let useCase: ResetPasswordUseCase;

  beforeEach(() => {
    mockPrisma = {
      verificationToken: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    } as unknown as jest.Mocked<PrismaClient>;

    mockHashProvider = {
      hash: jest.fn(),
      verify: jest.fn(),
    };

    mockSessionService = {
      revokeAllUserSessions: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    mockPasswordHistoryService = {
      assertNotReused: jest.fn().mockResolvedValue(undefined),
      archiveAndPrune: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PasswordHistoryService>;

    useCase = new ResetPasswordUseCase(
      mockPrisma,
      mockHashProvider,
      mockSessionService,
      mockPasswordHistoryService,
    );
  });

  it('should throw InvalidTokenError if token does not exist or is expired/used', async () => {
    (mockPrisma.verificationToken.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      useCase.execute({
        token: 'invalid-token',
        newPassword: 'Password123',
        confirmPassword: 'Password123',
      }),
    ).rejects.toThrow(InvalidTokenError);
  });

  it('should throw ValidationError if password history service rejects reuse of recent passwords', async () => {
    const mockToken = {
      id: 'vt-1',
      purpose: 'PASSWORD_RESET',
      usedAt: null,
      invalidatedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      user: {
        id: 'user-1',
        email: 'john.doe@example.com',
        passwordHash: '$argon2id$currenthash',
      },
    };
    (mockPrisma.verificationToken.findUnique as jest.Mock).mockResolvedValue(mockToken);
    mockPasswordHistoryService.assertNotReused.mockRejectedValueOnce(
      new ValidationError(PASSWORD_HISTORY_REUSE_ERROR),
    );

    await expect(
      useCase.execute({
        token: 'valid-raw-token',
        newPassword: 'ReusedPassword123!',
        confirmPassword: 'ReusedPassword123!',
      }),
    ).rejects.toThrow(new ValidationError(PASSWORD_HISTORY_REUSE_ERROR));

    expect(mockPasswordHistoryService.assertNotReused).toHaveBeenCalledWith(
      'user-1',
      '$argon2id$currenthash',
      'ReusedPassword123!',
    );
  });

  it('should throw ValidationError if new password equals email or local part (SEC-21)', async () => {
    const mockToken = {
      id: 'vt-1',
      purpose: 'PASSWORD_RESET',
      usedAt: null,
      invalidatedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      user: {
        id: 'user-1',
        email: 'john.doe@example.com',
        passwordHash: '$argon2id$currenthash',
      },
    };
    (mockPrisma.verificationToken.findUnique as jest.Mock).mockResolvedValue(mockToken);

    await expect(
      useCase.execute({
        token: 'valid-raw-token',
        newPassword: 'john.doe',
        confirmPassword: 'john.doe',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('should update password, archive/prune history, mark token used, revoke active sessions in transaction, and log audit', async () => {
    const mockToken = {
      id: 'vt-1',
      purpose: 'PASSWORD_RESET',
      usedAt: null,
      invalidatedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      user: {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: '$argon2id$currenthash',
      },
    };
    (mockPrisma.verificationToken.findUnique as jest.Mock).mockResolvedValue(mockToken);
    (mockHashProvider.hash as jest.Mock).mockResolvedValue('$argon2id$newhashedpassword');

    const result = await useCase.execute({
      token: 'valid-token',
      newPassword: 'NewSecurePassword123',
      confirmPassword: 'NewSecurePassword123',
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Password reset successfully. Please log in.');
    expect(mockPasswordHistoryService.assertNotReused).toHaveBeenCalledWith(
      'user-1',
      '$argon2id$currenthash',
      'NewSecurePassword123',
    );
    expect(mockPasswordHistoryService.archiveAndPrune).toHaveBeenCalledWith(
      mockPrisma,
      'user-1',
      '$argon2id$currenthash',
    );
    expect(mockHashProvider.hash).toHaveBeenCalledWith('NewSecurePassword123');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: '$argon2id$newhashedpassword' },
    });
    expect(mockPrisma.verificationToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'vt-1' },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      }),
    );
    expect(mockSessionService.revokeAllUserSessions).toHaveBeenCalledWith(
      'user-1',
      'Password Reset',
      mockPrisma,
    );
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'user-1',
          action: 'PASSWORD_RESET_SUCCESSFUL',
        }),
      }),
    );
  });
});
