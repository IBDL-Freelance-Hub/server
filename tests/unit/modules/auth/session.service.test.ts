import { PrismaClient } from '@prisma/client';
import {
  SessionService,
  INACTIVITY_TIMEOUT_MS,
} from '../../../../src/modules/auth/infrastructure/session.service';
import { NotFoundError } from '../../../../src/shared/errors';

describe('SessionService Unit Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let sessionService: SessionService;

  beforeEach(() => {
    mockPrisma = {
      session: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;

    sessionService = new SessionService(mockPrisma);
  });

  it('should create a new session storing SHA-256 token hash', async () => {
    (mockPrisma.session.create as jest.Mock).mockResolvedValue({});

    const result = await sessionService.createSession('user-1', '127.0.0.1', 'jest-agent');

    expect(result.rawToken).toBeDefined();
    expect(result.rawToken).toHaveLength(64); // 32 hex bytes = 64 chars
    expect(mockPrisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          tokenHash: sessionService.hashToken(result.rawToken),
          ipAddress: '127.0.0.1',
          userAgent: 'jest-agent',
        }),
      }),
    );
  });

  it('should validate an active session and update lastActivityAt if > 60 seconds elapsed', async () => {
    const mockSession = {
      id: 'session-1',
      userId: 'user-1',
      tokenHash: 'hashed-token',
      lastActivityAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      revokedAt: null,
      user: { id: 'user-1', email: 'test@example.com', member: null, staff: null },
    };

    (mockPrisma.session.findUnique as jest.Mock).mockResolvedValue(mockSession);
    (mockPrisma.session.update as jest.Mock).mockResolvedValue({
      ...mockSession,
      lastActivityAt: new Date(),
    });

    const result = await sessionService.validateSession('raw-token');

    expect(result).toBeDefined();
    expect(result?.user.email).toBe('test@example.com');
    expect(mockPrisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
      }),
    );
  });

  it('should throttle lastActivityAt DB update if <= 60 seconds elapsed (SEC-14)', async () => {
    const mockSession = {
      id: 'session-1',
      userId: 'user-1',
      tokenHash: 'hashed-token',
      lastActivityAt: new Date(Date.now() - 30 * 1000), // 30 seconds ago (< 60s)
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      revokedAt: null,
      user: { id: 'user-1', email: 'test@example.com', member: null, staff: null },
    };

    (mockPrisma.session.findUnique as jest.Mock).mockResolvedValue(mockSession);

    const result = await sessionService.validateSession('raw-token');

    expect(result).toBeDefined();
    expect(result?.user.email).toBe('test@example.com');
    expect(mockPrisma.session.update).not.toHaveBeenCalled();
  });

  it('should return null if session is revoked', async () => {
    const mockSession = {
      id: 'session-1',
      revokedAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    };

    (mockPrisma.session.findUnique as jest.Mock).mockResolvedValue(mockSession);

    const result = await sessionService.validateSession('raw-token');
    expect(result).toBeNull();
  });

  it('should return null if session has exceeded 30-minute inactivity limit', async () => {
    const mockSession = {
      id: 'session-1',
      revokedAt: null,
      lastActivityAt: new Date(Date.now() - (INACTIVITY_TIMEOUT_MS + 1000)), // 30 mins + 1 sec ago
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    };

    (mockPrisma.session.findUnique as jest.Mock).mockResolvedValue(mockSession);

    const result = await sessionService.validateSession('raw-token');
    expect(result).toBeNull();
  });

  it('should get active sessions and flag current session correctly (SEC-26)', async () => {
    const now = new Date();
    const mockDbSessions = [
      {
        id: 'session-1',
        userId: 'user-1',
        ipAddress: '127.0.0.1',
        userAgent: 'Agent 1',
        lastActivityAt: now,
        createdAt: now,
      },
      {
        id: 'session-2',
        userId: 'user-1',
        ipAddress: '192.168.1.1',
        userAgent: 'Agent 2',
        lastActivityAt: now,
        createdAt: now,
      },
    ];

    (mockPrisma.session.findMany as jest.Mock).mockResolvedValue(mockDbSessions);

    const sessions = await sessionService.getActiveSessions('user-1', 'session-1');

    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.isCurrent).toBe(true);
    expect(sessions[1]?.isCurrent).toBe(false);
  });

  it('should throw NotFoundError if revoking session belonging to another user', async () => {
    (mockPrisma.session.findUnique as jest.Mock).mockResolvedValue({
      id: 'session-2',
      userId: 'user-other',
    });

    await expect(
      sessionService.revokeSessionById('user-1', 'session-2', 'User Revocation'),
    ).rejects.toThrow(NotFoundError);
  });

  it('should revoke an active session by ID', async () => {
    const mockSession = {
      id: 'session-1',
      userId: 'user-1',
      revokedAt: null,
    };

    (mockPrisma.session.findUnique as jest.Mock).mockResolvedValue(mockSession);
    (mockPrisma.session.update as jest.Mock).mockResolvedValue({
      ...mockSession,
      revokedAt: new Date(),
      revokedReason: 'User Logout',
    });

    await sessionService.revokeSession('raw-token', 'User Logout');

    expect(mockPrisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: expect.objectContaining({
          revokedReason: 'User Logout',
        }),
      }),
    );
  });

  it('should revoke all active sessions for a user (SEC-25)', async () => {
    (mockPrisma.session.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

    const count = await sessionService.revokeAllUserSessions('user-1', 'Password Reset');

    expect(count).toBe(3);
    expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null },
        data: expect.objectContaining({ revokedReason: 'Password Reset' }),
      }),
    );
  });

  it('should delete expired sessions from database (AUT-38)', async () => {
    (mockPrisma.session.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

    const count = await sessionService.deleteExpiredSessions();

    expect(count).toBe(5);
    expect(mockPrisma.session.deleteMany).toHaveBeenCalled();
  });
});
