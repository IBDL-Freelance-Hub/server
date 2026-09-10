import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma, hashProvider, IHashProvider } from '../../../shared/providers';
import { InvalidActivationTokenError, ValidationError } from '../../../shared/errors';
import {
  SessionService,
  sessionService as defaultSessionService,
} from '../infrastructure/session.service';

export interface ActivateAccountInput {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ActivateAccountUseCaseResult {
  sessionToken: string;
  user: {
    id: string;
    email: string;
    status: string;
  };
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export class ActivateAccountUseCase {
  constructor(
    private prisma: PrismaClient = defaultPrisma,
    private hashProv: IHashProvider = hashProvider,
    private sessionSvc: SessionService = defaultSessionService,
  ) {}

  async execute(
    input: ActivateAccountInput,
    meta?: RequestMeta,
  ): Promise<ActivateAccountUseCaseResult> {
    const rawToken = input.token ? input.token.trim() : '';

    // 1. Hash raw token using SHA-256 for secure database lookup
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const tokenRecord = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    const now = new Date();

    // 2. Token Validation (SEC-29, AUT-12..14)
    // Token is invalid if: no matching row exists, OR usedAt is not null, OR invalidatedAt is not null, OR expiresAt < now()
    const isInvalidToken =
      !tokenRecord ||
      tokenRecord.purpose !== 'ACTIVATION' ||
      tokenRecord.usedAt !== null ||
      tokenRecord.invalidatedAt !== null ||
      tokenRecord.expiresAt < now;

    if (isInvalidToken) {
      // Audit invalid presentation attempt
      await this.prisma.auditLog.create({
        data: {
          action: 'ACTIVATION_FAILED',
          resource: 'VerificationToken',
          reason: 'invalid_or_expired_token',
          ipAddress: meta?.ipAddress || null,
        },
      });

      // Dedicated recovery state error response (VAL-142)
      throw new InvalidActivationTokenError();
    }

    const user = tokenRecord.user;

    // 3. User Status Defense-in-Depth Check
    // If account is already ACTIVE (a stale/replayed token), treat as anomaly: log distinctly in audit entry, return same recovery state response
    if (user.status !== 'UNACTIVATED') {
      await this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'ACTIVATION_FAILED',
          resource: 'User',
          resourceId: user.id,
          reason: 'activation_replay_on_active_account',
          ipAddress: meta?.ipAddress || null,
        },
      });

      throw new InvalidActivationTokenError();
    }

    // 4. Password Policy Validation (ONLY reached once token is valid)
    // Fetch SecurityConfig min length or fallback to 8
    const securityConfig = await this.prisma.securityConfig.findFirst({ where: { id: 1 } });
    const minLength = securityConfig?.passwordMinLength ?? 8;

    const emailLower = user.email.toLowerCase();
    const localPartLower = emailLower.split('@')[0];
    const passwordLower = input.password.toLowerCase();

    const passesPolicy =
      input.password.length >= minLength &&
      /[A-Z]/.test(input.password) &&
      /[a-z]/.test(input.password) &&
      /[0-9]/.test(input.password) &&
      passwordLower !== emailLower &&
      passwordLower !== localPartLower;

    if (!passesPolicy) {
      // Policy check happens FIRST; failure is a NORMAL validation error with NO audit entry
      throw new ValidationError(
        'Enter a password of at least 8 characters, including an uppercase letter, a lowercase letter and a number.',
        {
          messageAr: 'أدخل كلمة مرور من 8 أحرف على الأقل، تتضمن حرفاً كبيراً وحرفاً صغيراً ورقماً.',
        },
      );
    }

    // Confirmation check happens SECOND (only if policy passes)
    if (input.password !== input.confirmPassword) {
      throw new ValidationError('Passwords do not match.', {
        messageAr: 'كلمتا المرور غير متطابقتين.',
      });
    }

    // 5. Atomic Transaction on Successful Activation (Section 5)
    const passwordHash = await this.hashProv.hash(input.password);

    await this.prisma.$transaction(async (tx) => {
      // a. Hash & store password and set User.status = 'ACTIVE'
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          status: 'ACTIVE',
        },
      });

      // b. Mark consumed token
      await tx.verificationToken.update({
        where: { id: tokenRecord.id },
        data: {
          usedAt: new Date(),
        },
      });

      // c. Write audit log entry (action: "ACCOUNT_ACTIVATED")
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'ACCOUNT_ACTIVATED',
          resource: 'User',
          resourceId: user.id,
          ipAddress: meta?.ipAddress || null,
        },
      });
    });

    // TODO(notifications): persist "Account activated" notification + activity entry once Notification/Activity models exist

    // 6. Establish immediate server-side session
    const { rawToken: sessionToken } = await this.sessionSvc.createSession(
      user.id,
      meta?.ipAddress,
      meta?.userAgent,
    );

    return {
      sessionToken,
      user: {
        id: user.id,
        email: user.email,
        status: 'ACTIVE',
      },
    };
  }
}
