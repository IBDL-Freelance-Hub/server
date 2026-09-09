import { HashProvider } from '../../../src/shared/providers/hash.provider';

describe('HashProvider Unit Tests', () => {
  let hashProvider: HashProvider;

  beforeEach(() => {
    hashProvider = new HashProvider();
  });

  it('should generate an Argon2id hash and verify the plain text password', async () => {
    const plainPassword = 'SecurePassword123!';

    const hashedPassword = await hashProvider.hash(plainPassword);

    expect(hashedPassword).toBeDefined();
    expect(hashedPassword).toContain('$argon2id$');

    const isValid = await hashProvider.verify(hashedPassword, plainPassword);
    expect(isValid).toBe(true);
  });

  it('should return false when verifying an incorrect plain text password', async () => {
    const plainPassword = 'SecurePassword123!';
    const wrongPassword = 'WrongPassword456!';

    const hashedPassword = await hashProvider.hash(plainPassword);
    const isValid = await hashProvider.verify(hashedPassword, wrongPassword);

    expect(isValid).toBe(false);
  });

  it('should return false safely without throwing when given a malformed hash', async () => {
    const malformedHash = 'invalid-argon2-hash-string';
    const plainPassword = 'SecurePassword123!';

    const isValid = await hashProvider.verify(malformedHash, plainPassword);

    expect(isValid).toBe(false);
  });
});
