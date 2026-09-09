import { Request, Response, NextFunction } from 'express';
import { ActivateAccountUseCase } from '../application/activate-account.usecase';
import { LoginUseCase } from '../application/login.usecase';
import { LogoutUseCase } from '../application/logout.usecase';
import { sessionService } from '../infrastructure/session.service';

export const SESSION_COOKIE_NAME = 'flh_session';

export class AuthController {
  constructor(
    private activateUseCase = new ActivateAccountUseCase(),
    private loginUseCase = new LoginUseCase(),
    private logoutUseCase = new LogoutUseCase(),
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
}
