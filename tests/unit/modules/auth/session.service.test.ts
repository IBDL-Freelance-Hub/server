import { PrismaClient } from '@prisma/client';
import {
  SessionService,
  INACTIVITY_TIMEOUT_MS,
} from '../../../../src/modules/auth/infrastructure/session.service';

describe('SessionService Unit Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let sessionService: SessionService;

  beforeEach(() => {
    mockPrisma = {
      session: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
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

  it('should validate an active session and update lastActivityAt', async () => {
    const mockSession = {
      id: 'session-1',
      userId: 'user-1',
      tokenHash: 'hashed-token',
      lastActivityAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      revokedAt: null,
      user: { id: 'user-1', email: 'test@example.com' },
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

  it('should revoke an active session', async () => {
    const mockSession = {
      id: 'session-1',
      revokedAt: null,
    };

    (mockPrisma.session.findUnique as jest.Mock).mockResolvedValue(mockSession);
    (mockPrisma.session.update as jest.Mock).mockResolvedValue({});

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
});
