import { Request, Response, NextFunction } from 'express';
import { ActivateAccountUseCase } from '../application/activate-account.usecase';
import { ResendActivationLinkUseCase } from '../application/resend-activation-link.usecase';
import { LoginUseCase } from '../application/login.usecase';
import { LogoutUseCase } from '../application/logout.usecase';
import { ForgotPasswordUseCase } from '../application/forgot-password.usecase';
import { ResetPasswordUseCase } from '../application/reset-password.usecase';
import { ChangePasswordUseCase } from '../application/change-password.usecase';
import { GetActiveSessionsUseCase } from '../application/get-active-sessions.usecase';
import { RevokeSessionUseCase } from '../application/revoke-session.usecase';
import { sessionService } from '../infrastructure/session.service';
import { AuthenticationError, ValidationError } from '../../../shared/errors';

export const SESSION_COOKIE_NAME = 'flh_session';

export class AuthController {
  constructor(
    private activateUseCase = new ActivateAccountUseCase(),
    private resendActivationUseCase = new ResendActivationLinkUseCase(),
    private loginUseCase = new LoginUseCase(),
    private logoutUseCase = new LogoutUseCase(),
    private forgotPasswordUseCase = new ForgotPasswordUseCase(),
    private resetPasswordUseCase = new ResetPasswordUseCase(),
    private changePasswordUseCase = new ChangePasswordUseCase(),
    private getActiveSessionsUseCase = new GetActiveSessionsUseCase(),
    private revokeSessionUseCase = new RevokeSessionUseCase(),
  ) {}

  activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
      const result = await this.activateUseCase.execute(req.body, meta);

      res.cookie(SESSION_COOKIE_NAME, result.sessionToken, sessionService.getCookieOptions());

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  resendActivation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
      const result = await this.resendActivationUseCase.execute(req.body, meta);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
      const result = await this.loginUseCase.execute(req.body, meta);

      res.cookie(SESSION_COOKIE_NAME, result.sessionToken, sessionService.getCookieOptions());

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawToken =
        req.cookies?.[SESSION_COOKIE_NAME] || req.headers.authorization?.replace('Bearer ', '');

      if (rawToken) {
        await this.logoutUseCase.execute(rawToken);
      }

      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (err) {
      next(err);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
      const result = await this.forgotPasswordUseCase.execute(req.body, meta);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
      const result = await this.resetPasswordUseCase.execute(req.body, meta);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Your session has ended. Please sign in again.');
      }

      const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
      const context = { userId: req.user.id, currentSessionId: req.user.sessionId };
      const result = await this.changePasswordUseCase.execute(req.body, context, meta);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  };

  getActiveSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Your session has ended. Please sign in again.');
      }

      const sessions = await this.getActiveSessionsUseCase.execute(req.user.id, req.user.sessionId);

      res.status(200).json({
        success: true,
        data: { sessions },
      });
    } catch (err) {
      next(err);
    }
  };

  revokeSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Your session has ended. Please sign in again.');
      }

      const { sessionId } = req.params;
      if (!sessionId) {
        throw new ValidationError('Session ID is required');
      }

      const result = await this.revokeSessionUseCase.execute({
        userId: req.user.id,
        targetSessionId: String(sessionId),
        currentSessionId: req.user.sessionId,
        reason: 'Revoked by user',
        ipAddress: req.ip,
        requestId: req.id,
      });

      if (result.isCurrentSession) {
        res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      }

      res.status(200).json({
        success: true,
        message: 'Session revoked successfully',
      });
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Your session has ended. Please sign in again.');
      }

      res.status(200).json({
        success: true,
        data: {
          user: req.user,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
