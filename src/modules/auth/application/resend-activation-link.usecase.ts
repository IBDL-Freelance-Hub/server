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

export interface ResendActivationInput {
  email: string;
}

export interface ResendActivationResult {
  success: boolean;
  message: string;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export class ResendActivationLinkUseCase {
  constructor(
    private prisma: PrismaClient = defaultPrisma,
    private rateLimiter: TokenRateLimiterService = defaultRateLimiter,
    private emailSvc: IEmailProvider = defaultEmailProvider,
  ) {}

  async execute(input: ResendActivationInput, meta?: RequestMeta): Promise<ResendActivationResult> {
    const emailNormalized = normalizeEmail(input.email);
    const ipAddress = meta?.ipAddress || 'unknown';

    // 1. Shared Token Rate Limiter Check (Missing Part B)
    const rateCheck = await this.rateLimiter.checkAndLogRequest({
      purpose: 'ACTIVATION',
      email: emailNormalized,
      ipAddress,
    });

    const genericSuccessResponse = {
      success: true,
      message: 'If an account exists and is unactivated, a new link has been sent.',
    };

    if (!rateCheck.allowed) {
      // Return constant generic success without issuing token (Audit entry logged by rateLimiter)
      return genericSuccessResponse;
    }

    // 2. Locate User
    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
    });

    if (user && user.status === 'UNACTIVATED') {
      const config = await this.prisma.securityConfig.findFirst({ where: { id: 1 } });
      const cfg = config as
        | (typeof config & {
            activationLinkLifetimeMinutes?: number;
            activationLinkLifetimeDays?: number;
          })
        | null;
      const lifetimeMinutes =
        cfg?.activationLinkLifetimeMinutes ??
        (cfg?.activationLinkLifetimeDays ? cfg.activationLinkLifetimeDays * 24 * 60 : 10);

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + lifetimeMinutes * 60 * 1000);

      await this.prisma.$transaction(async (tx) => {
        // Invalidate old tokens for this user & purpose (so old link can't race)
        await tx.verificationToken.updateMany({
          where: {
            userId: user.id,
            purpose: 'ACTIVATION',
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
            purpose: 'ACTIVATION',
            tokenHash,
            expiresAt,
          },
        });

        // Audit entry (action: "ACTIVATION_LINK_RESENT")
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'ACTIVATION_LINK_RESENT',
            resource: 'User',
            resourceId: user.id,
            ipAddress,
          },
        });
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const activationLink = `${frontendUrl}/activate?token=${rawToken}`;

      await this.emailSvc.sendEmail({
        to: user.email,
        subject: 'Activate Your IBDL Freelancer Hub Account',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #0056b3;">Activate Your IBDL Freelancer Hub Account</h2>
            <p>Hello,</p>
            <p>Please click the button below to set your password and activate your account:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${activationLink}" style="background-color: #0056b3; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Activate Account</a>
            </div>
            <p style="font-size: 13px; color: #666;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 13px; color: #0056b3; word-break: break-all;">${activationLink}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999;">This link will expire in <strong>10 minutes</strong>. If you did not request this link, you can safely ignore this email.</p>
          </div>
        `,
      });
    }

    return genericSuccessResponse;
  }
}
