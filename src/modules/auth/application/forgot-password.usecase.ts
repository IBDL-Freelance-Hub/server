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
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #0056b3;">Password Reset Request</h2>
            <p>Hello,</p>
            <p>We received a request to reset the password for your IBDL Freelancer Hub account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #0056b3; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            <p style="font-size: 13px; color: #666;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 13px; color: #0056b3; word-break: break-all;">${resetLink}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999;">This link will expire in <strong>${lifetimeMinutes} minutes</strong>. If you did not request a password reset, you can safely ignore this email.</p>
          </div>
        `,
      });
    }

    return genericSuccessResponse;
  }
}
