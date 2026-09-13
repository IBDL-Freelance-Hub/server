import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma, hashProvider, IHashProvider } from '../../../shared/providers';
import {
  emailProvider as defaultEmailProvider,
  IEmailProvider,
} from '../../../shared/providers/email.provider';
import { normalizeEmail } from '../../../shared/utils';
import {
  AuthenticationError,
  AuthorizationError,
  AccountLockedError,
} from '../../../shared/errors';
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
  language?: 'ar' | 'en';
}

export const LOCKED_ACCOUNT_DETAILS = {
  title: 'Account temporarily locked',
  titleAr: 'تم قفل الحساب مؤقتاً',
  body: 'Your account has been temporarily locked after multiple unsuccessful login attempts. To regain access, please use Forgot Password to reset your password. If you continue to have trouble accessing your account, please contact Freelancers Hub Support.',
  bodyAr:
    'تم قفل حسابك مؤقتاً بعد عدة محاولات دخول غير ناجحة. لاستعادة الوصول، يرجى استخدام خيار نسيت كلمة المرور لإعادة تعيينها. إذا استمرت المشكلة، يرجى التواصل مع دعم Freelancers Hub.',
};

export const LOCKED_ACCOUNT_MESSAGE = LOCKED_ACCOUNT_DETAILS.body;

export function getAttemptsRemainingMessage(n: number, lang: 'ar' | 'en' = 'en'): string {
  if (lang === 'ar') {
    return `لا يطابق هذا البريد الإلكتروني وكلمة المرور أي حساب. تبقّت ${n} محاولات قبل قفل حسابك مؤقتاً.`;
  }
  return `That email address and password do not match an account. ${n} attempts remaining before your account is temporarily locked.`;
}

export class LoginUseCase {
  constructor(
    private prisma: PrismaClient = defaultPrisma,
    private hashProv: IHashProvider = hashProvider,
    private sessionSvc: SessionService = defaultSessionService,
    private emailProv: IEmailProvider = defaultEmailProvider,
  ) {}

  async execute(input: LoginInput, meta?: RequestMeta): Promise<LoginUseCaseResult> {
    const emailNormalized = normalizeEmail(input.email);
    const lang = meta?.language || 'en';

    // Read dynamic SecurityConfig (default threshold 5, lockoutDuration 30 min)
    const secConfig = await this.prisma.securityConfig.findFirst();
    const lockoutThreshold = secConfig?.lockoutThreshold ?? 5;
    const lockoutDurationMinutes = secConfig?.lockoutDurationMinutes ?? 30;

    // 1. Check EmailLockout BEFORE checking credentials (keyed by emailNormalized string)
    const existingLockout = await this.prisma.emailLockout.findUnique({
      where: { emailNormalized },
    });

    const now = new Date();
    if (existingLockout?.lockedUntil && existingLockout.lockedUntil > now) {
      // Record failed attempt in LoginAttempt for audit/analysis even when already locked (POINT 3)
      await this.prisma.loginAttempt.create({
        data: {
          email: input.email,
          emailNormalized,
          ipAddress: meta?.ipAddress || '',
          successful: false,
        },
      });

      throw new AccountLockedError(lang);
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
      // Record failed attempt audit log in LoginAttempt table (POINT 3)
      await this.prisma.loginAttempt.create({
        data: {
          email: input.email,
          emailNormalized,
          ipAddress: meta?.ipAddress || '',
          successful: false,
        },
      });

      // Increment EmailLockout failed count for emailNormalized
      const currentAttempts = existingLockout ? existingLockout.failedAttemptCount : 0;
      const newAttempts = currentAttempts + 1;

      let isNowLocked = false;
      let lockedUntilDate: Date | null = null;

      if (newAttempts >= lockoutThreshold) {
        isNowLocked = true;
        lockedUntilDate = new Date(Date.now() + lockoutDurationMinutes * 60 * 1000);
      }

      await this.prisma.emailLockout.upsert({
        where: { emailNormalized },
        create: {
          emailNormalized,
          failedAttemptCount: newAttempts,
          lockedUntil: lockedUntilDate,
        },
        update: {
          failedAttemptCount: newAttempts,
          lockedUntil: lockedUntilDate,
        },
      });

      if (isNowLocked) {
        // Send SEC-22 security notification email ONLY if account is real (POINT 4)
        if (user) {
          this.emailProv
            .sendEmail({
              to: user.email,
              subject:
                lang === 'ar'
                  ? 'تنبيه أمني: تم قفل الحساب مؤقتاً'
                  : 'Security Notice: Account Temporarily Locked',
              html: `<p>${lang === 'ar' ? LOCKED_ACCOUNT_DETAILS.bodyAr : LOCKED_ACCOUNT_DETAILS.body}</p>`,
            })
            .catch(async (err) => {
              console.warn('[SecurityNoticeEmail Error]', err);
              try {
                await this.prisma.auditLog.create({
                  data: {
                    actorId: user.id,
                    actorRole: user.userType,
                    action: 'SECURITY_NOTIFICATION_FAILED',
                    resource: 'User',
                    resourceId: user.id,
                    reason: err instanceof Error ? err.message : String(err),
                    ipAddress: meta?.ipAddress || null,
                  },
                });
              } catch (auditErr) {
                console.error('[AuditLog SecurityNotification Error]', auditErr);
              }
            });
        }

        throw new AccountLockedError(lang);
      }

      const remainingAttempts = lockoutThreshold - newAttempts;
      throw new AuthenticationError(getAttemptsRemainingMessage(remainingAttempts, lang));
    }

    // 4. Check account status if user exists
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

    // 5. Successful login — reset EmailLockout counters for this emailNormalized
    await this.prisma.emailLockout.upsert({
      where: { emailNormalized },
      create: {
        emailNormalized,
        failedAttemptCount: 0,
        lockedUntil: null,
      },
      update: {
        failedAttemptCount: 0,
        lockedUntil: null,
      },
    });

    // Record successful attempt in LoginAttempt table
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
