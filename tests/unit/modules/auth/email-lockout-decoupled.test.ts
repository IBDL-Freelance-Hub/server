/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  LoginUseCase,
  LOCKED_ACCOUNT_DETAILS,
  getAttemptsRemainingMessage,
} from '../../../../src/modules/auth/application/login.usecase';
import { AccountLockedError } from '../../../../src/shared/errors/appError';
import { loginAction } from '../../../../../client/src/actions/authActions';

// ─── Next.js module stubs ────────────────────────────────────────────────────

jest.mock('server-only', () => {}, { virtual: true });

jest.mock(
  'next/headers',
  () => ({
    cookies: jest.fn().mockResolvedValue({
      set: jest.fn(),
      get: jest.fn().mockReturnValue(undefined),
      delete: jest.fn(),
    }),
    headers: jest.fn().mockResolvedValue({
      get: jest.fn().mockReturnValue(null),
      has: jest.fn().mockReturnValue(false),
    }),
  }),
  { virtual: true },
);

// ─── Client-side module stubs ─────────────────────────────────────────────────

jest.mock('../../../../../client/src/lib/api', () => ({
  ApiClient: jest.fn(),
  api: {
    get: jest.fn().mockRejectedValue(new Error('api.get: not wired in this test suite')),
    post: jest.fn().mockRejectedValue(new Error('api.post: not wired in this test suite')),
    put: jest.fn().mockRejectedValue(new Error('api.put: not wired in this test suite')),
    delete: jest.fn().mockRejectedValue(new Error('api.delete: not wired in this test suite')),
  },
}));

jest.mock('../../../../../client/src/lib/session', () => ({
  SESSION_COOKIE_NAME: 'flh_session',
  setSessionCookie: jest.fn().mockResolvedValue(undefined),
  getSessionCookie: jest.fn().mockResolvedValue(undefined),
  clearSessionCookie: jest.fn().mockResolvedValue(undefined),
}));

describe('Decoupled EmailLockout & Login Failure UX Protocol', () => {
  let lockoutStore: Map<
    string,
    { emailNormalized: string; failedAttemptCount: number; lockedUntil: Date | null }
  >;
  let mockPrisma: any;
  let mockHashProv: any;
  let mockSessionSvc: any;
  let mockEmailProv: any;

  beforeEach(() => {
    lockoutStore = new Map();

    mockPrisma = {
      securityConfig: {
        findFirst: jest.fn().mockResolvedValue({
          lockoutThreshold: 5,
          lockoutDurationMinutes: 30,
        }),
      },
      emailLockout: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const record = lockoutStore.get(where.emailNormalized);
          return Promise.resolve(record || null);
        }),
        upsert: jest.fn().mockImplementation(({ where, create, update }) => {
          const existing = lockoutStore.get(where.emailNormalized);
          const newRecord = existing
            ? {
                ...existing,
                failedAttemptCount: update.failedAttemptCount,
                lockedUntil: update.lockedUntil,
              }
            : {
                emailNormalized: create.emailNormalized,
                failedAttemptCount: create.failedAttemptCount,
                lockedUntil: create.lockedUntil,
              };
          lockoutStore.set(where.emailNormalized, newRecord);
          return Promise.resolve(newRecord);
        }),
      },
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.emailNormalized === 'real@example.com') {
            return Promise.resolve({
              id: 'user-real-123',
              email: 'real@example.com',
              emailNormalized: 'real@example.com',
              passwordHash: '$2b$10$hashedPassword',
              userType: 'MEMBER',
              status: 'ACTIVE',
            });
          }
          return Promise.resolve(null);
        }),
      },
      loginAttempt: {
        create: jest.fn().mockResolvedValue({ id: 'attempt-1' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
      },
    };

    mockHashProv = {
      verify: jest.fn().mockImplementation((_hash, password) => {
        return Promise.resolve(password === 'CorrectPassword123!');
      }),
    };

    mockSessionSvc = {
      createSession: jest.fn().mockResolvedValue({ rawToken: 'session-token-xyz' }),
    };

    mockEmailProv = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('Point 1: Arabic Language Parity', () => {
    it('returns exact Arabic error messages for "attempts remaining" and "account locked"', async () => {
      const loginUseCase = new LoginUseCase(
        mockPrisma,
        mockHashProv,
        mockSessionSvc,
        mockEmailProv,
      );
      const email = 'real@example.com';
      const wrongPassword = 'WrongPassword!';

      // Attempt 1 with language: 'ar'
      try {
        await loginUseCase.execute({ email, password: wrongPassword }, { language: 'ar' });
      } catch (err: unknown) {
        expect((err as Error).message).toBe(
          'لا يطابق هذا البريد الإلكتروني وكلمة المرور أي حساب. تبقّت 4 محاولات قبل قفل حسابك مؤقتاً.',
        );
      }

      // Pre-lock account and test Arabic locked response
      lockoutStore.set(email, {
        emailNormalized: email,
        failedAttemptCount: 5,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
      });

      try {
        await loginUseCase.execute({ email, password: wrongPassword }, { language: 'ar' });
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AccountLockedError);
        expect((err as AccountLockedError).title).toBe('تم قفل الحساب مؤقتاً');
        expect((err as AccountLockedError).body).toBe(LOCKED_ACCOUNT_DETAILS.bodyAr);
      }
    });
  });

  describe('Point 2: Split & De-duplicated Response Shape for Locked Message', () => {
    it('exposes separate title and body fields on AccountLockedError without redundant details', async () => {
      const err = new AccountLockedError('en');
      expect(err.title).toBe('Account temporarily locked');
      expect(err.body).toBe(LOCKED_ACCOUNT_DETAILS.body);
      expect((err.details as Record<string, string>)?.titleAr).toBe('تم قفل الحساب مؤقتاً');
      expect((err.details as Record<string, string>)?.bodyAr).toBe(LOCKED_ACCOUNT_DETAILS.bodyAr);
    });
  });

  describe('Point 3: LoginAttempt Audit Logging', () => {
    it('creates a LoginAttempt record on EVERY failed attempt including already locked accounts', async () => {
      const loginUseCase = new LoginUseCase(
        mockPrisma,
        mockHashProv,
        mockSessionSvc,
        mockEmailProv,
      );
      const email = 'real@example.com';
      const wrongPassword = 'WrongPassword!';

      // Attempt 1
      try {
        await loginUseCase.execute({ email, password: wrongPassword });
      } catch {
        // Expected authentication failure
      }

      expect(mockPrisma.loginAttempt.create).toHaveBeenCalledTimes(1);

      // Lock account in store
      lockoutStore.set(email, {
        emailNormalized: email,
        failedAttemptCount: 5,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
      });

      // Subsequent attempt while locked
      try {
        await loginUseCase.execute({ email, password: wrongPassword });
      } catch {
        // Expected locked failure
      }

      expect(mockPrisma.loginAttempt.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('Point 4: Security Notification & Audit Failure Logging (SEC-22)', () => {
    it('sends security email ONLY when a REAL account becomes locked, not for fake emails', async () => {
      const loginUseCase = new LoginUseCase(
        mockPrisma,
        mockHashProv,
        mockSessionSvc,
        mockEmailProv,
      );
      const realEmail = 'real@example.com';
      const fakeEmail = 'nonexistent@example.com';
      const wrongPassword = 'WrongPassword!';

      // 5 failed attempts on REAL account
      for (let i = 0; i < 5; i++) {
        try {
          await loginUseCase.execute({ email: realEmail, password: wrongPassword });
        } catch {
          // Expected failure
        }
      }

      expect(mockEmailProv.sendEmail).toHaveBeenCalledTimes(1);
      expect(mockEmailProv.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'real@example.com',
          subject: 'Security Notice: Account Temporarily Locked',
        }),
      );

      // Reset and test FAKE email
      mockEmailProv.sendEmail.mockClear();
      lockoutStore.clear();

      for (let i = 0; i < 5; i++) {
        try {
          await loginUseCase.execute({ email: fakeEmail, password: wrongPassword });
        } catch {
          // Expected failure
        }
      }

      expect(mockEmailProv.sendEmail).not.toHaveBeenCalled();
    });

    it('creates an AuditLog entry with action SECURITY_NOTIFICATION_FAILED if sendEmail fails', async () => {
      mockEmailProv.sendEmail.mockRejectedValueOnce(new Error('SMTP connection failed'));

      const loginUseCase = new LoginUseCase(
        mockPrisma,
        mockHashProv,
        mockSessionSvc,
        mockEmailProv,
      );
      const realEmail = 'real@example.com';
      const wrongPassword = 'WrongPassword!';

      for (let i = 0; i < 5; i++) {
        try {
          await loginUseCase.execute({ email: realEmail, password: wrongPassword });
        } catch {
          // Expected failure
        }
      }

      await new Promise((resolve) => setImmediate(resolve));

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'SECURITY_NOTIFICATION_FAILED',
          resource: 'User',
          resourceId: 'user-real-123',
          reason: 'SMTP connection failed',
        }),
      });
    });
  });

  describe('Point 5: Config-Driven Dynamic Thresholds', () => {
    it('triggers lockout after 3 attempts when SecurityConfig.lockoutThreshold is 3', async () => {
      mockPrisma.securityConfig.findFirst.mockResolvedValue({
        lockoutThreshold: 3,
        lockoutDurationMinutes: 15,
      });

      const loginUseCase = new LoginUseCase(
        mockPrisma,
        mockHashProv,
        mockSessionSvc,
        mockEmailProv,
      );
      const email = 'customconfig@example.com';
      const wrongPassword = 'WrongPassword!';

      // Attempt 1: 2 remaining
      try {
        await loginUseCase.execute({ email, password: wrongPassword });
      } catch (err: unknown) {
        expect((err as Error).message).toBe(getAttemptsRemainingMessage(2));
      }

      // Attempt 2: 1 remaining
      try {
        await loginUseCase.execute({ email, password: wrongPassword });
      } catch (err: unknown) {
        expect((err as Error).message).toBe(getAttemptsRemainingMessage(1));
      }

      // Attempt 3: threshold 3 reached -> LOCKED
      try {
        await loginUseCase.execute({ email, password: wrongPassword });
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AccountLockedError);
        expect((err as AccountLockedError).body).toBe(LOCKED_ACCOUNT_DETAILS.body);
      }
    });
  });

  describe('Point 6: Normalization Consistency', () => {
    it('proves "Ahmed@Example.com" and "ahmed@example.com" resolve to the exact same EmailLockout row', async () => {
      const loginUseCase = new LoginUseCase(
        mockPrisma,
        mockHashProv,
        mockSessionSvc,
        mockEmailProv,
      );

      // Attempt 1 with mixed-case email
      try {
        await loginUseCase.execute({ email: 'Ahmed@Example.com', password: 'WrongPassword!' });
      } catch {
        // Expected failure
      }

      // Attempt 2 with lower-case email
      try {
        await loginUseCase.execute({ email: 'ahmed@example.com', password: 'WrongPassword!' });
      } catch {
        // Expected failure
      }

      const record = lockoutStore.get('ahmed@example.com');
      expect(record).toBeDefined();
      expect(record?.failedAttemptCount).toBe(2);
    });
  });

  describe('Identical Attempt Counter & Lockout Behavior (Real vs Non-Existent Email)', () => {
    it('produces byte-for-byte identical message sequence and lockout for REAL vs FAKE email', async () => {
      const loginUseCase = new LoginUseCase(
        mockPrisma,
        mockHashProv,
        mockSessionSvc,
        mockEmailProv,
      );

      const realEmail = 'real@example.com';
      const fakeEmail = 'nonexistent@example.com';
      const wrongPassword = 'WrongPassword999!';

      const realMessages: string[] = [];
      const fakeMessages: string[] = [];

      // Execute 5 wrong attempts for REAL email
      for (let i = 0; i < 5; i++) {
        try {
          await loginUseCase.execute({ email: realEmail, password: wrongPassword });
        } catch (err: unknown) {
          const message = (err as Error).message || (err as AccountLockedError).body;
          realMessages.push(message);
        }
      }

      lockoutStore.clear();

      // Execute 5 wrong attempts for FAKE email
      for (let i = 0; i < 5; i++) {
        try {
          await loginUseCase.execute({ email: fakeEmail, password: wrongPassword });
        } catch (err: unknown) {
          const message = (err as Error).message || (err as AccountLockedError).body;
          fakeMessages.push(message);
        }
      }

      expect(realMessages.length).toBe(5);
      expect(fakeMessages.length).toBe(5);
      expect(realMessages).toEqual(fakeMessages);

      expect(realMessages[0]).toBe(getAttemptsRemainingMessage(4));
      expect(realMessages[1]).toBe(getAttemptsRemainingMessage(3));
      expect(realMessages[2]).toBe(getAttemptsRemainingMessage(2));
      expect(realMessages[3]).toBe(getAttemptsRemainingMessage(1));
      expect(realMessages[4]).toBe(LOCKED_ACCOUNT_DETAILS.body);
    });
  });

  describe('Phase 1 Schema & Format Validation (Next.js authActions)', () => {
    it('returns fieldErrors for empty email field', async () => {
      const result = await loginAction({ email: '', password: 'Password123!' });
      expect(result.success).toBe(false);
      expect(result).toHaveProperty('fieldErrors');
      if (!result.success) {
        expect(result.fieldErrors?.email).toContain('Please enter your email address.');
      }
    });

    it('returns fieldErrors for empty password field', async () => {
      const result = await loginAction({ email: 'user@example.com', password: '' });
      expect(result.success).toBe(false);
      expect(result).toHaveProperty('fieldErrors');
      if (!result.success) {
        expect(result.fieldErrors?.password).toContain('Please enter your password.');
      }
    });

    it('returns fieldErrors for invalid email format (VAL-11)', async () => {
      const result = await loginAction({ email: 'invalid-email-str', password: 'Password123!' });
      expect(result.success).toBe(false);
      expect(result).toHaveProperty('fieldErrors');
      if (!result.success) {
        expect(result.fieldErrors?.email).toContain('Enter a valid email address.');
      }
    });
  });
});
