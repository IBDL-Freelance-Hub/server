import { Request, Response, NextFunction } from 'express';
import { requireAuth, optionalAuth } from '../../../src/shared/middleware/requireAuth.middleware';
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
      member: { id: 'member-456' },
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

describe('optionalAuth Middleware Unit Tests', () => {
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

  it('should call next() cleanly and leave req.user undefined when no token is present', async () => {
    await optionalAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
    expect(sessionService.validateSession).not.toHaveBeenCalled();
  });

  it('should call next() cleanly and leave req.user undefined when token is invalid (session returns null)', async () => {
    req.cookies = { flh_session: 'invalid-token' };
    (sessionService.validateSession as jest.Mock).mockResolvedValue(null);

    await optionalAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('should call next() cleanly and leave req.user undefined when user is SUSPENDED or CLOSED', async () => {
    req.headers = { authorization: 'Bearer suspended-token' };
    (sessionService.validateSession as jest.Mock).mockResolvedValue({
      session: { id: 's-sus' },
      user: {
        id: 'u-sus',
        email: 'suspended@ibdl.net',
        userType: 'MEMBER',
        status: 'SUSPENDED',
      },
    });

    await optionalAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('should call next() and populate req.user when valid active session is provided', async () => {
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

    await optionalAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({
      id: 'user-123',
      email: 'member@ibdl.net',
      userType: 'MEMBER',
      status: 'ACTIVE',
      staffRole: null,
      memberId: 'member-456',
      member: { id: 'member-456' },
      sessionId: 's-1',
    });
  });

  it('should fail silently and call next() if validateSession throws an error', async () => {
    req.cookies = { flh_session: 'malformed-token' };
    (sessionService.validateSession as jest.Mock).mockRejectedValue(
      new Error('Database connection failed'),
    );

    await optionalAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });
});
