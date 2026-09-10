import { PrismaClient, TokenPurpose } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { normalizeEmail } from '../../../shared/utils';

export interface RateLimitCheckParams {
  purpose: TokenPurpose;
  email: string;
  ipAddress: string;
}

export interface RateLimitCheckResult {
  allowed: boolean;
}

export class TokenRateLimiterService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async checkAndLogRequest(params: RateLimitCheckParams): Promise<RateLimitCheckResult> {
    const emailNormalized = normalizeEmail(params.email);
    const now = new Date();

    // 1. Fetch active SecurityConfig limits or use defaults
    const config = await this.prisma.securityConfig.findFirst({
      where: { id: 1 },
    });

    const maxPerEmail = config?.tokenRequestMaxPerEmail ?? 5;
    const windowMinutesPerEmail = config?.tokenRequestWindowMinutesPerEmail ?? 60;
    const maxPerIp = config?.tokenRequestMaxPerIp ?? 10;
    const windowMinutesPerIp = config?.tokenRequestWindowMinutesPerIp ?? 60;

    const emailWindowStart = new Date(now.getTime() - windowMinutesPerEmail * 60 * 1000);
    const ipWindowStart = new Date(now.getTime() - windowMinutesPerIp * 60 * 1000);

    // 2. Log this request attempt into TokenRequestLog
    await this.prisma.tokenRequestLog.create({
      data: {
        purpose: params.purpose,
        email: emailNormalized,
        ipAddress: params.ipAddress,
        requestedAt: now,
      },
    });

    // 3. Count recent requests within windows
    const [emailCount, ipCount] = await Promise.all([
      this.prisma.tokenRequestLog.count({
        where: {
          email: emailNormalized,
          purpose: params.purpose,
          requestedAt: { gte: emailWindowStart },
        },
      }),
      this.prisma.tokenRequestLog.count({
        where: {
          ipAddress: params.ipAddress,
          purpose: params.purpose,
          requestedAt: { gte: ipWindowStart },
        },
      }),
    ]);

    // 4. Determine if limit was hit (note: count includes current attempt)
    if (emailCount > maxPerEmail || ipCount > maxPerIp) {
      // Write audit log entry flagged as rate-limited for administrator review
      await this.prisma.auditLog.create({
        data: {
          action: 'TOKEN_REQUEST_RATE_LIMITED',
          resource: 'TokenRequestLog',
          reason: 'rate_limit_exceeded',
          ipAddress: params.ipAddress,
          newState: {
            email: emailNormalized,
            ipAddress: params.ipAddress,
            purpose: params.purpose,
            emailCount,
            ipCount,
            maxPerEmail,
            maxPerIp,
          },
        },
      });

      return { allowed: false };
    }

    return { allowed: true };
  }
}

export const tokenRateLimiterService = new TokenRateLimiterService();
