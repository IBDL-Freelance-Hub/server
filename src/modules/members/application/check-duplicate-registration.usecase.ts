import { PrismaClient } from '@prisma/client';
import {
  prisma as defaultPrisma,
  IRateLimiterProvider,
  MemoryRateLimiter,
} from '../../../shared/providers';
import { normalizeEmail } from '../../../shared/utils';
import { normalizePhoneNumber } from '../domain';
import { TooManyRequestsError } from '../../../shared/errors';

export interface CheckDuplicateInput {
  email?: string;
  mobile?: string;
  country?: string;
}

export interface CheckDuplicateResult {
  isDuplicate: boolean;
  clashType: 'none' | 'email' | 'mobile' | 'both';
  emailClash: boolean;
  mobileClash: boolean;
}

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CHECKS_PER_WINDOW = 30;
const CONSTANT_TIMING_MS = 100; // Constant execution delay baseline

const defaultRateLimiter = new MemoryRateLimiter(5000);

export class CheckDuplicateRegistrationUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly rateLimiter: IRateLimiterProvider = defaultRateLimiter,
  ) {}

  async execute(input: CheckDuplicateInput, ipAddress = 'unknown'): Promise<CheckDuplicateResult> {
    const startTime = Date.now();

    try {
      // 1. IP Rate Limiting Check (Distributed-ready via IRateLimiterProvider)
      const isLimited = await this.rateLimiter.isRateLimited(ipAddress, {
        windowMs: RATE_LIMIT_WINDOW_MS,
        maxRequests: MAX_CHECKS_PER_WINDOW,
      });

      if (isLimited) {
        throw new TooManyRequestsError(
          'Too many duplicate check attempts from this IP. Please try again later.',
        );
      }

      // 2. Data Normalization with Country Fallback
      let emailClash = false;
      let mobileClash = false;

      const emailNormalized = input.email ? normalizeEmail(input.email) : null;

      const phoneNormalized =
        input.mobile && input.country
          ? normalizePhoneNumber(input.mobile, input.country.trim().toUpperCase())
          : null;

      // 3. Real DB Queries in Parallel
      const [userMatch, memberMatch] = await Promise.all([
        emailNormalized
          ? this.prisma.user.findUnique({ where: { emailNormalized } })
          : Promise.resolve(null),
        phoneNormalized
          ? this.prisma.member.findUnique({ where: { phoneNormalized } })
          : Promise.resolve(null),
      ]);

      if (userMatch) emailClash = true;
      if (memberMatch) mobileClash = true;

      let clashType: 'none' | 'email' | 'mobile' | 'both' = 'none';
      if (emailClash && mobileClash) clashType = 'both';
      else if (emailClash) clashType = 'email';
      else if (mobileClash) clashType = 'mobile';

      const isDuplicate = emailClash || mobileClash;

      return {
        isDuplicate,
        clashType,
        emailClash,
        mobileClash,
      };
    } finally {
      // 4. Constant Timing Enforcer (Guaranteed execution in both success and error branches)
      await this.padExecutionTime(startTime, CONSTANT_TIMING_MS);
    }
  }

  private async padExecutionTime(startTime: number, targetMs: number): Promise<void> {
    const elapsed = Date.now() - startTime;
    if (elapsed < targetMs) {
      await new Promise((resolve) => setTimeout(resolve, targetMs - elapsed));
    }
  }
}
