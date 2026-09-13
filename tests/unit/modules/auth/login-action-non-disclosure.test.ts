import { loginAction } from '../../../../../client/src/actions/authActions';
import { api } from '../../../../../client/src/lib/api';

jest.mock('server-only', () => {}, { virtual: true });
jest.mock(
  'next/headers',
  () => ({
    cookies: jest.fn().mockResolvedValue({
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    }),
    headers: jest.fn().mockResolvedValue(new Map()),
  }),
  { virtual: true },
);

describe('FIX 3: Schema Validation vs DB Authentication Non-Disclosure (SEC-23)', () => {
  describe('Phase 1: Format / Schema Validation Failures', () => {
    it('returns fieldErrors with format message for malformed email', async () => {
      const result = await loginAction({ email: 'not-an-email', password: 'Password123!' });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('fieldErrors');
      if (!result.success) {
        expect(result.fieldErrors?.email).toContain('Enter a valid email address.');
        expect(result.error).not.toBe('That email address and password do not match an account.');
      }
    });

    it('returns fieldErrors with required-field message for empty password', async () => {
      const result = await loginAction({ email: 'valid.user@example.com', password: '' });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('fieldErrors');
      if (!result.success) {
        expect(result.fieldErrors?.password).toContain('Password is required');
        expect(result.error).not.toBe('That email address and password do not match an account.');
      }
    });
  });

  describe('Phase 2: Database Authentication Check Failures (SEC-23 Non-Disclosure)', () => {
    it('returns exact same generic error and response shape for wrong password vs locked account vs non-existent user', async () => {
      // 1. Wrong Password / Non-existent user
      const wrongPasswordResult = await loginAction({
        email: 'user@example.com',
        password: 'WrongPassword123!',
      });

      expect(wrongPasswordResult.success).toBe(false);
      expect(wrongPasswordResult).toHaveProperty('error');
      expect(wrongPasswordResult).not.toHaveProperty('fieldErrors');
      if (!wrongPasswordResult.success) {
        expect(wrongPasswordResult.error).toBe(
          'That email address and password do not match an account.',
        );
      }

      // 2. Mock API backend response simulating locked account (HTTP 423 / Account Locked error)
      const postSpy = jest.spyOn(api, 'post').mockRejectedValueOnce(new Error('Account locked'));

      const lockedAccountResult = await loginAction({
        email: 'locked.user@example.com',
        password: 'Password123!',
      });

      expect(lockedAccountResult.success).toBe(false);
      expect(lockedAccountResult).toHaveProperty('error');
      expect(lockedAccountResult).not.toHaveProperty('fieldErrors');
      if (!lockedAccountResult.success) {
        expect(lockedAccountResult.error).toBe(
          'That email address and password do not match an account.',
        );
      }

      // 3. Verify wrong password and locked account returns are identical in shape and message
      expect(lockedAccountResult).toEqual(wrongPasswordResult);

      postSpy.mockRestore();
    });
  });
});
