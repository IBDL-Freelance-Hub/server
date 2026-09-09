import {
  passwordSchema,
  activateAccountSchema,
  loginSchema,
  PASSWORD_ERROR_MESSAGE,
} from '../../../../src/modules/auth/presentation/auth.schema';

describe('Auth Validation Schemas Unit Tests', () => {
  describe('Password Policy Schema', () => {
    it('should pass for a valid password matching all criteria', () => {
      expect(passwordSchema.safeParse('Password123').success).toBe(true);
      expect(passwordSchema.safeParse('ComplexP@ssw0rd').success).toBe(true);
    });

    it('should fail when password is less than 8 characters', () => {
      const result = passwordSchema.safeParse('Pass12');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(PASSWORD_ERROR_MESSAGE);
      }
    });

    it('should fail when password lacks an uppercase letter', () => {
      const result = passwordSchema.safeParse('password123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(PASSWORD_ERROR_MESSAGE);
      }
    });

    it('should fail when password lacks a lowercase letter', () => {
      const result = passwordSchema.safeParse('PASSWORD123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(PASSWORD_ERROR_MESSAGE);
      }
    });

    it('should fail when password lacks a number', () => {
      const result = passwordSchema.safeParse('PasswordName');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(PASSWORD_ERROR_MESSAGE);
      }
    });
  });

  describe('Activate Account Schema', () => {
    const validActivationPayload = {
      email: 'user@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    };

    it('should pass when password and confirmPassword match', () => {
      const result = activateAccountSchema.safeParse(validActivationPayload);
      expect(result.success).toBe(true);
    });

    it('should fail when password and confirmPassword do not match', () => {
      const payload = {
        ...validActivationPayload,
        confirmPassword: 'DifferentPassword123',
      };

      const result = activateAccountSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join('.') === 'confirmPassword');
        expect(issue?.message).toBe('Passwords do not match.');
      }
    });
  });

  describe('Login Schema', () => {
    it('should pass for a valid login payload', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'Password123',
      });
      expect(result.success).toBe(true);
    });

    it('should fail for an empty password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });
});
