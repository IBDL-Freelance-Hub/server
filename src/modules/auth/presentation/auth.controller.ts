import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
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
import {
  SessionService,
  sessionService as defaultSessionService,
} from '../infrastructure/session.service';
import { AuthenticationError, NotFoundError, ValidationError } from '../../../shared/errors';
import { getClientIp } from '../../../shared/utils';

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
    private sessionSvc: SessionService = defaultSessionService,
    private prisma: PrismaClient = defaultPrisma,
  ) {}

  activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientIp = getClientIp(req);
      const meta = { ipAddress: clientIp, userAgent: req.headers['user-agent'] };
      const result = await this.activateUseCase.execute(req.body, meta);

      res.status(200).json({
        success: true,
        data: {
          sessionToken: result.sessionToken,
          user: result.user,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  resendActivation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientIp = getClientIp(req);
      const meta = { ipAddress: clientIp, userAgent: req.headers['user-agent'] };
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
      const clientIp = getClientIp(req);
      const meta = {
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        language: (req.language || 'en') as 'ar' | 'en',
      };
      const result = await this.loginUseCase.execute(req.body, meta);

      res.status(200).json({
        success: true,
        data: {
          sessionToken: result.sessionToken,
          sessionTimeoutMinutes: result.sessionTimeoutMinutes,
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
        req.headers.authorization?.replace('Bearer ', '') ||
        req.body?.sessionToken ||
        req.body?.token;

      if (rawToken) {
        const clientIp = getClientIp(req);
        await this.logoutUseCase.execute(rawToken, 'User Logout', {
          ipAddress: clientIp,
          requestId: req.id,
        });
      }

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
      const clientIp = getClientIp(req);
      const meta = { ipAddress: clientIp, userAgent: req.headers['user-agent'] };
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
      const clientIp = getClientIp(req);
      const meta = { ipAddress: clientIp, userAgent: req.headers['user-agent'] };
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

      const clientIp = getClientIp(req);
      const meta = { ipAddress: clientIp, userAgent: req.headers['user-agent'] };
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

      const clientIp = getClientIp(req);
      await this.revokeSessionUseCase.execute({
        userId: req.user.id,
        targetSessionId: String(sessionId),
        currentSessionId: req.user.sessionId,
        reason: 'Revoked by user',
        ipAddress: clientIp,
        requestId: req.id,
      });

      res.status(200).json({
        success: true,
        message: 'Session revoked successfully',
      });
    } catch (err) {
      next(err);
    }
  };

  revokeOtherSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Your session has ended. Please sign in again.');
      }

      await this.sessionSvc.revokeOtherUserSessions(
        req.user.id,
        req.user.sessionId || '',
        'Revoked all other sessions by user',
      );

      res.status(200).json({
        success: true,
        message: 'All other sessions revoked successfully',
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

      const member = await this.prisma.member.findUnique({
        where: { userId: req.user.id },
        include: {
          memberships: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!member) {
        throw new NotFoundError('Member profile not found');
      }

      const activeMembership = member.memberships[0] || null;

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: req.user.id,
            email: req.user.email,
            status: req.user.status,
          },
          member: {
            fullNameEn: member.fullNameEn,
            fullNameAr: member.fullNameAr,
            phone: member.phone,
            country: member.country,
            city: member.city,
            yearsOfExperience: member.yearsOfExperience,
            areasOfExpertise: member.areasOfExpertise,
            industriesServed: member.industriesServed,
            languages: member.languages,
            bioEn: member.bioEn,
            bioAr: member.bioAr,
            linkedinUrl: member.linkedinUrl,
            photoFileId: member.photoFileId,
            directoryOptIn: member.directoryOptIn,
            profileCompletionRate: member.profileCompletionRate,
          },
          membership: activeMembership
            ? {
                tier: activeMembership.tier,
                status: activeMembership.status,
                startDate: activeMembership.startDate,
                endDate: activeMembership.endDate,
              }
            : null,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
