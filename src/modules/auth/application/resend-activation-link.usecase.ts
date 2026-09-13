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
import { buildBrandEmailHtml } from '../../../shared/templates/email-template';

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
        html: buildBrandEmailHtml({
          title: 'Activate Your IBDL Freelancer Hub Account',
          preheader: 'Please set up your password to activate your Freelancers Hub membership.',
          contentHtml: `
            <p>Hello,</p>
            <p>Welcome to <strong>IBDL Freelancers Hub</strong>! Please click the button below to set up your password and complete your account activation:</p>
          `,
          ctaText: 'Activate Account',
          ctaUrl: activationLink,
          footnote: `This activation link will expire in <strong>10 minutes</strong>. If you did not request this link, you can safely ignore this email.`,
        }),
      });
    }

    return genericSuccessResponse;
  }
}
