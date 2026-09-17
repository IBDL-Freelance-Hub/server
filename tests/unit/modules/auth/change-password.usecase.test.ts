import { PrismaClient } from '@prisma/client';
import { ChangePasswordUseCase } from '../../../../src/modules/auth/application/change-password.usecase';
import { IHashProvider, IEmailProvider } from '../../../../src/shared/providers';
import { SessionService } from '../../../../src/modules/auth/infrastructure/session.service';
import { PasswordHistoryService } from '../../../../src/modules/auth/infrastructure/password-history.service';
import { ValidationError } from '../../../../src/shared/errors';
import { PASSWORD_HISTORY_REUSE_ERROR } from '../../../../src/modules/auth/domain';

describe('ChangePasswordUseCase Unit Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockHashProvider: jest.Mocked<IHashProvider>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockEmailProvider: jest.Mocked<IEmailProvider>;
  let mockPasswordHistoryService: jest.Mocked<PasswordHistoryService>;
  let useCase: ChangePasswordUseCase;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
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
      revokeOtherUserSessions: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    mockEmailProvider = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };

    mockPasswordHistoryService = {
      assertNotReused: jest.fn().mockResolvedValue(undefined),
      archiveAndPrune: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PasswordHistoryService>;

    useCase = new ChangePasswordUseCase(
      mockPrisma,
      mockHashProvider,
      mockSessionService,
      mockEmailProvider,
      mockPasswordHistoryService,
    );
  });

  it('should throw AuthenticationError if user does not exist or has no passwordHash', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      useCase.execute(
        {
          currentPassword: 'OldPassword123',
          newPassword: 'NewPassword123',
          confirmPassword: 'NewPassword123',
        },
        { userId: 'non-existent-user' },
      ),
    ).rejects.toThrow('User not found.');
  });

  it('should throw AuthenticationError if currentPassword is incorrect', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: '$argon2id$oldhash',
    };
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockHashProvider.verify as jest.Mock).mockResolvedValue(false);

    await expect(
      useCase.execute(
        {
          currentPassword: 'WrongOldPassword123',
          newPassword: 'NewPassword123',
          confirmPassword: 'NewPassword123',
        },
        { userId: 'user-1' },
      ),
    ).rejects.toThrow('Current password is incorrect.');
  });

  it('should throw ValidationError if password history service rejects reuse of recent passwords', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: '$argon2id$oldhash',
    };
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockHashProvider.verify as jest.Mock).mockResolvedValue(true);
    mockPasswordHistoryService.assertNotReused.mockRejectedValueOnce(
      new ValidationError(PASSWORD_HISTORY_REUSE_ERROR),
    );

    await expect(
      useCase.execute(
        {
          currentPassword: 'OldPassword123',
          newPassword: 'OldPassword123',
          confirmPassword: 'OldPassword123',
        },
        { userId: 'user-1' },
      ),
    ).rejects.toThrow(PASSWORD_HISTORY_REUSE_ERROR);

    expect(mockPasswordHistoryService.assertNotReused).toHaveBeenCalledWith(
      'user-1',
      '$argon2id$oldhash',
      'OldPassword123',
    );
  });

  it('should throw ValidationError if newPassword matches user email or local part (SEC-21)', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'john.doe@example.com',
      passwordHash: '$argon2id$oldhash',
    };
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockHashProvider.verify as jest.Mock).mockResolvedValue(true);

    // Matching local part "john.doe"
    await expect(
      useCase.execute(
        {
          currentPassword: 'OldPassword123',
          newPassword: 'john.doe',
          confirmPassword: 'john.doe',
        },
        { userId: 'user-1' },
      ),
    ).rejects.toThrow('Password cannot be the same as your email address or username.');
  });

  it('should successfully update password, archive/prune history, revoke other sessions, log audit entry and notify user via email', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'john.doe@example.com',
      passwordHash: '$argon2id$oldhash',
    };
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockHashProvider.verify as jest.Mock).mockResolvedValue(true);
    (mockHashProvider.hash as jest.Mock).mockResolvedValue('$argon2id$newhash');
    (mockSessionService.revokeOtherUserSessions as jest.Mock).mockResolvedValue(2);

    const result = await useCase.execute(
      {
        currentPassword: 'OldPassword123',
        newPassword: 'NewPassword123',
        confirmPassword: 'NewPassword123',
      },
      { userId: 'user-1', currentSessionId: 'session-acting-1' },
      { ipAddress: '192.168.1.100' },
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe('Password changed successfully.');

    expect(mockPasswordHistoryService.assertNotReused).toHaveBeenCalledWith(
      'user-1',
      '$argon2id$oldhash',
      'NewPassword123',
    );
    expect(mockPasswordHistoryService.archiveAndPrune).toHaveBeenCalledWith(
      mockPrisma,
      'user-1',
      '$argon2id$oldhash',
    );
    expect(mockHashProvider.hash).toHaveBeenCalledWith('NewPassword123');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: '$argon2id$newhash' },
    });

    expect(mockSessionService.revokeOtherUserSessions).toHaveBeenCalledWith(
      'user-1',
      'session-acting-1',
      'Password Changed',
      mockPrisma,
    );

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'user-1',
        action: 'PASSWORD_CHANGED',
        resource: 'User',
        resourceId: 'user-1',
        ipAddress: '192.168.1.100',
      },
    });

    expect(mockEmailProvider.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'john.doe@example.com',
        subject: 'Security Notice: Your Password Has Been Changed',
      }),
    );
  });
});

describe('SessionService.revokeOtherUserSessions Unit Test', () => {
  it('should call updateMany with userId, exceptSessionId, and revokedAt=null filter', async () => {
    const mockPrisma = {
      session: {
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    } as unknown as jest.Mocked<PrismaClient>;

    const service = new SessionService(mockPrisma);
    const count = await service.revokeOtherUserSessions('user-100', 'acting-session-id');

    expect(count).toBe(3);
    expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-100',
        id: { not: 'acting-session-id' },
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: 'Password Changed',
      },
    });
  });
});
