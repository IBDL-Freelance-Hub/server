import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  prisma as defaultPrisma,
  emailProvider as defaultEmailProvider,
  IEmailProvider,
} from '../../../shared/providers';
import { normalizeEmail } from '../../../shared/utils';
import {
  TokenRateLimiterService,
  tokenRateLimiterService as defaultRateLimiter,
} from '../infrastructure/token-rate-limiter.service';
import { ForgotPasswordInput } from '../presentation/auth.schema';

import { buildBrandEmailHtml } from '../../../shared/templates/email-template';

export interface ForgotPasswordResult {
  success: boolean;
  message: string;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export class ForgotPasswordUseCase {
  constructor(
    private prisma: PrismaClient = defaultPrisma,
    private rateLimiter: TokenRateLimiterService = defaultRateLimiter,
    private emailSvc: IEmailProvider = defaultEmailProvider,
  ) {}

  async execute(input: ForgotPasswordInput, meta?: RequestMeta): Promise<ForgotPasswordResult> {
    const emailNormalized = normalizeEmail(input.email);
    const ipAddress = meta?.ipAddress || 'unknown';

    const genericSuccessResponse: ForgotPasswordResult = {
      success: true,
      message: 'If that email matches an account, a secure reset link has been sent.',
    };

    // 1. Rate Limiter Check (purpose: 'PASSWORD_RESET')
    const rateCheck = await this.rateLimiter.checkAndLogRequest({
      purpose: 'PASSWORD_RESET',
      email: emailNormalized,
      ipAddress,
    });

    if (!rateCheck.allowed) {
      return genericSuccessResponse;
    }

    // 2. Locate User
    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
    });

    // 3. Process only for ACTIVE users (silent response for non-existent / non-active users)
    if (user && user.status === 'ACTIVE') {
      const config = await this.prisma.securityConfig.findFirst({ where: { id: 1 } });
      const lifetimeMinutes = config?.resetTokenLifetimeMinutes ?? 10;

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + lifetimeMinutes * 60 * 1000);

      await this.prisma.$transaction(async (tx) => {
        // Invalidate old unused reset tokens for this user
        await tx.verificationToken.updateMany({
          where: {
            userId: user.id,
            purpose: 'PASSWORD_RESET',
            usedAt: null,
            invalidatedAt: null,
          },
          data: {
            invalidatedAt: now,
          },
        });

        // Issue fresh VerificationToken
        await tx.verificationToken.create({
          data: {
            userId: user.id,
            purpose: 'PASSWORD_RESET',
            tokenHash,
            expiresAt,
          },
        });

        // Audit Log Entry
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'PASSWORD_RESET_REQUESTED',
            resource: 'User',
            resourceId: user.id,
            ipAddress,
          },
        });
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

      await this.emailSvc.sendEmail({
        to: user.email,
        subject: 'Reset Your IBDL Freelancer Hub Password',
        html: buildBrandEmailHtml({
          title: 'Password Reset Request',
          preheader: 'We received a request to reset your IBDL Freelancer Hub password.',
          contentHtml: `
            <p>Hello,</p>
            <p>We received a request to reset the password for your <strong>IBDL Freelancer Hub</strong> account.</p>
            <p>Please click the button below to choose a new password:</p>
          `,
          ctaText: 'Reset Password',
          ctaUrl: resetLink,
          footnote: `This reset link will expire in <strong>${lifetimeMinutes} minutes</strong>. If you did not request a password reset, you can safely ignore this email.`,
        }),
      });
    }

    return genericSuccessResponse;
  }
}
