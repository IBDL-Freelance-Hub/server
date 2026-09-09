import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma, hashProvider, IHashProvider } from '../../../shared/providers';
import { normalizeEmail } from '../../../shared/utils';
import { AuthenticationError, AuthorizationError } from '../../../shared/errors';
import { evaluateLockout } from '../domain/lockout-policy';
import {
  SessionService,
  sessionService as defaultSessionService,
} from '../infrastructure/session.service';
import { LoginInput } from '../presentation/auth.schema';

export interface LoginUseCaseResult {
  sessionToken: string;
  user: {
    id: string;
    email: string;
    userType: string;
    status: string;
  };
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export class LoginUseCase {
  constructor(
    private prisma: PrismaClient = defaultPrisma,
    private hashProv: IHashProvider = hashProvider,
    private sessionSvc: SessionService = defaultSessionService,
  ) {}

  async execute(input: LoginInput, meta?: RequestMeta): Promise<LoginUseCaseResult> {
    const emailNormalized = normalizeEmail(input.email);

    // 1. Check account lockout policy (SEC-22, ERR-92)
    const recentFailedAttempts = await this.prisma.loginAttempt.findMany({
      where: {
        emailNormalized,
        successful: false,
        attemptedAt: {
          gte: new Date(Date.now() - 45 * 60 * 1000),
        },
      },
      orderBy: { attemptedAt: 'asc' },
    });

    const lockoutStatus = evaluateLockout(recentFailedAttempts);
    if (lockoutStatus.isLocked) {
      throw new AuthenticationError('Account locked. Try again in 30 minutes.');
    }

    // 2. Fetch User by emailNormalized
    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
    });

    // 3. Verify user exists & password matches
    let isValidPassword = false;
    if (user && user.passwordHash) {
      isValidPassword = await this.hashProv.verify(user.passwordHash, input.password);
    }

    if (!user || !isValidPassword) {
      // Record failed attempt
      await this.prisma.loginAttempt.create({
        data: {
          email: input.email,
          emailNormalized,
          ipAddress: meta?.ipAddress || '',
          successful: false,
        },
      });

      // Generic authentication error to prevent enumeration (AUT-09, SEC-23)
      throw new AuthenticationError('Invalid email or password.');
    }

    // 4. Check account status
    if (user.status === 'SUSPENDED' || user.status === 'CLOSED') {
      await this.prisma.loginAttempt.create({
        data: {
          email: user.email,
          emailNormalized,
          ipAddress: meta?.ipAddress || '',
          successful: false,
        },
      });

      throw new AuthorizationError('Account is not active.');
    }

    // 5. Record successful attempt
    await this.prisma.loginAttempt.create({
      data: {
        email: user.email,
        emailNormalized,
        ipAddress: meta?.ipAddress || '',
        successful: true,
      },
    });

    // 6. Create session
    const { rawToken } = await this.sessionSvc.createSession(
      user.id,
      meta?.ipAddress,
      meta?.userAgent,
    );

    return {
      sessionToken: rawToken,
      user: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        status: user.status,
      },
    };
  }
}
