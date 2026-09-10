import { PrismaClient } from '@prisma/client';
import { RevokeSessionUseCase } from '../../../../src/modules/auth/application/revoke-session.usecase';
import { SessionService } from '../../../../src/modules/auth/infrastructure/session.service';

describe('RevokeSessionUseCase Unit Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockSessionService: jest.Mocked<SessionService>;
  let useCase: RevokeSessionUseCase;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(),
      auditLog: {
        create: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;

    mockSessionService = {
      revokeSessionById: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    useCase = new RevokeSessionUseCase(mockPrisma, mockSessionService);
  });

  it('should revoke target session and write SESSION_REVOKED audit log', async () => {
    const mockAuditCreate = jest.fn().mockResolvedValue({});

    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const tx = {
        auditLog: { create: mockAuditCreate },
      };
      return callback(tx);
    });

    mockSessionService.revokeSessionById.mockResolvedValue({
      id: 'session-2',
      userId: 'user-123',
      tokenHash: 'hash',
      ipAddress: '127.0.0.1',
      userAgent: 'Agent',
      lastActivityAt: new Date(),
      expiresAt: new Date(),
      revokedAt: new Date(),
      revokedReason: 'Revoked by user',
      createdAt: new Date(),
    });

    const result = await useCase.execute({
      userId: 'user-123',
      targetSessionId: 'session-2',
      currentSessionId: 'session-1',
      reason: 'Revoked by user',
      ipAddress: '127.0.0.1',
      requestId: 'req-abc',
    });

    expect(result.isCurrentSession).toBe(false);
    expect(mockSessionService.revokeSessionById).toHaveBeenCalledWith(
      'user-123',
      'session-2',
      'Revoked by user',
      expect.anything(),
    );
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SESSION_REVOKED',
          resource: 'Session',
          resourceId: 'session-2',
        }),
      }),
    );
  });

  it('should detect when the current active session is being revoked', async () => {
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const tx = {
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      return callback(tx);
    });

    mockSessionService.revokeSessionById.mockResolvedValue({
      id: 'session-1',
      userId: 'user-123',
      tokenHash: 'hash',
      ipAddress: '127.0.0.1',
      userAgent: 'Agent',
      lastActivityAt: new Date(),
      expiresAt: new Date(),
      revokedAt: new Date(),
      revokedReason: 'Revoked by user',
      createdAt: new Date(),
    });

    const result = await useCase.execute({
      userId: 'user-123',
      targetSessionId: 'session-1',
      currentSessionId: 'session-1',
    });

    expect(result.isCurrentSession).toBe(true);
  });
});
