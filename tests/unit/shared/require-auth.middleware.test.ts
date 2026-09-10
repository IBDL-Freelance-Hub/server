import { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../../src/shared/middleware/requireAuth.middleware';
import { sessionService } from '../../../src/modules/auth/infrastructure/session.service';
import { AuthenticationError } from '../../../src/shared/errors';

jest.mock('../../../src/modules/auth/infrastructure/session.service');

describe('requireAuth Middleware Unit Tests', () => {
  let req: Partial<Request> & { user?: unknown };
  let res: Partial<Response>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    req = {
      cookies: {},
      headers: {},
    };
    res = {};
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should throw AuthenticationError if no session cookie or Bearer header is present', async () => {
    await requireAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    const error = next.mock.calls[0]![0] as unknown as AuthenticationError;
    expect(error.message).toBe('Your session has ended. Please sign in again.');
  });

  it('should throw AuthenticationError if session validation returns null', async () => {
    req.cookies = { flh_session: 'invalid-token' };
    (sessionService.validateSession as jest.Mock).mockResolvedValue(null);

    await requireAuth(req as Request, res as Response, next);

    expect(sessionService.validateSession).toHaveBeenCalledWith('invalid-token');
    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
  });

  it('should populate req.user and call next() on valid active session', async () => {
    req.headers = { authorization: 'Bearer valid-token' };
    const mockUser = {
      id: 'user-123',
      email: 'member@ibdl.net',
      userType: 'MEMBER',
      status: 'ACTIVE',
      member: { id: 'member-456' },
      staff: null,
    };

    (sessionService.validateSession as jest.Mock).mockResolvedValue({
      session: { id: 's-1' },
      user: mockUser,
    });

    await requireAuth(req as Request, res as Response, next);

    expect(sessionService.validateSession).toHaveBeenCalledWith('valid-token');
    expect(req.user).toEqual({
      id: 'user-123',
      email: 'member@ibdl.net',
      userType: 'MEMBER',
      status: 'ACTIVE',
      staffRole: null,
      memberId: 'member-456',
      sessionId: 's-1',
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('should throw AuthenticationError if user status is SUSPENDED or CLOSED', async () => {
    req.cookies = { flh_session: 'token-suspended' };
    const mockSuspendedUser = {
      id: 'user-789',
      email: 'suspended@ibdl.net',
      userType: 'MEMBER',
      status: 'SUSPENDED',
      member: null,
      staff: null,
    };

    (sessionService.validateSession as jest.Mock).mockResolvedValue({
      session: { id: 's-2' },
      user: mockSuspendedUser,
    });

    await requireAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
  });
});
