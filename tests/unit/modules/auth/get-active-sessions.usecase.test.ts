import { GetActiveSessionsUseCase } from '../../../../src/modules/auth/application/get-active-sessions.usecase';
import { SessionService } from '../../../../src/modules/auth/infrastructure/session.service';

describe('GetActiveSessionsUseCase Unit Tests', () => {
  let mockSessionService: jest.Mocked<SessionService>;
  let useCase: GetActiveSessionsUseCase;

  beforeEach(() => {
    mockSessionService = {
      getActiveSessions: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    useCase = new GetActiveSessionsUseCase(mockSessionService);
  });

  it('should return list of active sessions with isCurrent set correctly', async () => {
    const mockSessions = [
      {
        id: 'session-1',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        isCurrent: true,
      },
      {
        id: 'session-2',
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome Mobile',
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        isCurrent: false,
      },
    ];

    mockSessionService.getActiveSessions.mockResolvedValue(mockSessions);

    const result = await useCase.execute('user-123', 'session-1');

    expect(result).toEqual(mockSessions);
    expect(mockSessionService.getActiveSessions).toHaveBeenCalledWith('user-123', 'session-1');
  });
});
