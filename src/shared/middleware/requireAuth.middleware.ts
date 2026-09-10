import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '../errors';
import { sessionService } from '../../modules/auth/infrastructure/session.service';

export const SESSION_COOKIE_NAME = 'flh_session';

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const rawToken =
      req.cookies?.[SESSION_COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!rawToken) {
      throw new AuthenticationError('Your session has ended. Please sign in again.');
    }

    const authResult = await sessionService.validateSession(rawToken);

    if (!authResult) {
      throw new AuthenticationError('Your session has ended. Please sign in again.');
    }

    const { session, user } = authResult;

    if (user.status === 'SUSPENDED' || user.status === 'CLOSED' || user.status === 'DELETED') {
      throw new AuthenticationError('Your session has ended. Please sign in again.');
    }

    req.user = {
      id: user.id,
      email: user.email,
      userType: user.userType as 'MEMBER' | 'STAFF',
      status: user.status as 'ACTIVE' | 'UNACTIVATED' | 'SUSPENDED' | 'CLOSED',
      staffRole: user.staff?.role || null,
      memberId: user.member?.id || null,
      sessionId: session.id,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const authenticate = requireAuth;
